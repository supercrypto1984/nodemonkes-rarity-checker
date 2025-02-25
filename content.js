/**
 * NodeMonkes Rarity Checker - Content Script
 *
 * Purpose:
 * This content script enhances the Magic Eden marketplace by displaying rarity information
 * for NodeMonkes NFTs. It creates an overlay tooltip when hovering over NFT cards.
 *
 * Permission Usage (activeTab):
 * 1. Read DOM elements on Magic Eden marketplace to identify NFT cards
 * 2. Create and position tooltip overlays for rarity information
 * 3. Only activates on NodeMonkes collection pages
 *
 * Privacy Notice:
 * - No user data is collected or transmitted
 * - Only reads public NFT information from the webpage
 * - All rarity data is stored locally within the extension
 * - No tracking or analytics
 */

let monkesData = null
let attributeStats = null
let lastHoveredCard = null

// Ensure chrome is defined for development environment
if (typeof chrome === "undefined") {
  var chrome = {}
}

/**
 * Calculates rarity statistics for all attributes
 * @param {Array} data - Array of NodeMonkes metadata
 * @returns {Object} Attribute statistics with rarity percentages
 */
function calculateAttributeStats(data) {
  const stats = {}
  const total = data.length

  data.forEach((monke) => {
    Object.entries(monke.attributes).forEach(([key, value]) => {
      if (!key.endsWith("Count") && key !== "Count") {
        if (!stats[key]) {
          stats[key] = {}
        }
        if (!stats[key][value]) {
          stats[key][value] = 0
        }
        stats[key][value]++
      }
    })
  })

  Object.keys(stats).forEach((trait) => {
    Object.keys(stats[trait]).forEach((value) => {
      stats[trait][value] = ((stats[trait][value] / total) * 100).toFixed(2)
    })
  })

  return stats
}

/**
 * Loads metadata from local extension file
 * Uses chrome.runtime.getURL to access extension resources
 */
async function loadMetadata() {
  try {
    const url = chrome.runtime?.getURL("metadata.json")
    const response = await fetch(url)
    monkesData = await response.json()
    attributeStats = calculateAttributeStats(monkesData)
  } catch (error) {
    console.error("Failed to load metadata:", error)
  }
}

/**
 * Determines color coding for rank display
 * @param {number} rank - NodeMonke rank
 * @returns {string} Hex color code
 */
function getRankColor(rank) {
  if (rank <= 100) return "#FFD700"
  if (rank <= 1000) return "#FF4444"
  return "#FFFFFF"
}

/**
 * Determines color coding for count display
 * @param {number} count - Trait count
 * @returns {string} Hex color code
 */
function getCountColor(count) {
  if (count === 1) return "#FFD700" // Gold for single trait
  if (count === 2) return "#FF4444" // Red for double trait
  return "#FFFFFF" // White for 3 or 4 traits
}

/**
 * Determines rarity class for styling
 * @param {number} rank - NodeMonke rank
 * @returns {string} CSS class name
 */
function getRarityClass(rank) {
  if (rank <= 100) return "legendary"
  if (rank <= 1000) return "rare"
  return "common"
}

/**
 * Calculates grade based on rank
 * @param {number} rank - NodeMonke rank
 * @returns {string} Grade (A+, A, B+, B, C)
 */
function getGrade(rank) {
  if (rank <= 100) return "A+"
  if (rank <= 500) return "A"
  if (rank <= 1000) return "B+"
  if (rank <= 2000) return "B"
  return "C"
}

/**
 * Creates HTML content for tooltip
 * @param {Object} monkeData - NodeMonke metadata
 * @returns {string} HTML string for tooltip content
 */
function createTooltipContent(monkeData) {
  if (!monkeData || !attributeStats) return ""

  const rankColor = getRankColor(monkeData.rank)
  const countColor = getCountColor(monkeData.attributes.Count)
  const rarityClass = getRarityClass(monkeData.rank)
  const grade = getGrade(monkeData.rank)

  const traits = Object.entries(monkeData.attributes)
    .filter(([key]) => !key.endsWith("Count") && key !== "id" && key !== "Count")
    .map(([key, value]) => {
      const percentage = attributeStats[key]?.[value]
      const isRare = percentage && Number.parseFloat(percentage) < 1

      return `
        <div class="trait-item ${isRare ? "rare" : ""}">
          <span>${key}: ${value}</span>
          ${percentage ? `<span class="percentage">${percentage}%</span>` : ""}
        </div>
      `
    })
    .join("")

  return `
    <div class="tooltip-inner">
      <div class="monke-id">NodeMonke #${monkeData.id}</div>
      <div class="rank-info" style="color: ${rankColor}">
        Rank: ${monkeData.rank || "N/A"} <span class="grade-badge">${grade}</span>
      </div>
      
      <div class="traits-list">
        ${traits}
      </div>
      
      <div class="count-info" style="color: ${countColor}">
        Count: ${monkeData.attributes.Count}
      </div>
    </div>
  `
}

/**
 * Removes tooltip from DOM
 */
function hideTooltip() {
  const tooltip = document.querySelector(".nodemonkes-tooltip-extension")
  if (tooltip) {
    tooltip.remove()
  }
}

/**
 * Finds NFT card element from mouse event
 * Uses activeTab permission to read DOM elements
 * @param {MouseEvent} event - Mouse event
 * @returns {Element|null} NFT card element or null
 */
function findNFTCard(event) {
  // Respect restricted areas
  if (event.clientX < 250 && event.clientY < 100) {
    return null
  }

  let current = event.target

  // Check for excluded interactive elements
  const excludedElements = ["button", ".instant-sell", ".sell-now", ".view-offers"]
  if (current.closest(excludedElements.join(","))) {
    return null
  }

  // Find NFT container element
  while (current && !(current.querySelector("img") && current.querySelector('a[href*="/ordinals/item-details/"]'))) {
    current = current.parentElement
    if (!current || current.tagName === "BODY") return null
  }

  return current
}

/**
 * Calculates optimal tooltip position
 * Ensures tooltip stays within viewport and handles edge cases
 * @param {DOMRect} rect - Element bounding rectangle
 * @param {Element} tooltip - Tooltip element
 * @returns {Object} Position coordinates
 */
function calculateTooltipPosition(rect, tooltip) {
  const tooltipWidth = tooltip.offsetWidth
  const tooltipHeight = tooltip.offsetHeight
  const windowWidth = window.innerWidth
  const windowHeight = window.innerHeight
  const scrollY = window.scrollY

  // Calculate available space below and above the element
  const spaceBelow = windowHeight - (rect.bottom - scrollY)
  const spaceAbove = rect.top - scrollY

  // Default to showing below the element
  let top = rect.bottom + 5

  // If there isn't enough space below and there's more space above, show above
  if (spaceBelow < tooltipHeight + 10 && spaceAbove > tooltipHeight + 10) {
    top = rect.top - tooltipHeight - 5
  }

  let left = rect.left

  // If tooltip would extend beyond right edge, align to right
  if (left + tooltipWidth > windowWidth) {
    left = windowWidth - tooltipWidth - 10
  }

  // Ensure minimum left position
  left = Math.max(10, left)

  // Special handling for top navigation area
  if (left < 250 && top < 350) {
    if (rect.right + tooltipWidth + 10 <= windowWidth) {
      // If there's space, show to the right of the element
      left = rect.right + 5
    } else {
      // Otherwise, ensure we're at least 250px from left
      left = 250
    }
  }

  return {
    top: `${top}px`,
    left: `${left}px`,
  }
}

/**
 * Handles mouse hover over NFT cards
 * Creates and positions tooltip with rarity information
 * @param {MouseEvent} event - Mouse event
 */
function handleMonkeHover(event) {
  const card = findNFTCard(event)

  if (!card) {
    hideTooltip()
    lastHoveredCard = null
    return
  }

  if (card === lastHoveredCard) {
    return
  }

  lastHoveredCard = card

  const linkElement = card.querySelector('a[href*="/ordinals/item-details/"]') || card
  const inscriptionId = linkElement.href.split("/").pop()
  if (!inscriptionId) return

  const monkeData = monkesData.find((m) => m.inscriptionId === inscriptionId)
  if (!monkeData) return

  let tooltipContainer = document.querySelector(".nodemonkes-tooltip-extension")
  if (!tooltipContainer) {
    tooltipContainer = document.createElement("div")
    tooltipContainer.className = `nodemonkes-tooltip-extension ${getRarityClass(monkeData.rank)}`
    document.body.appendChild(tooltipContainer)
  }

  tooltipContainer.innerHTML = createTooltipContent(monkeData)

  const rect = card.getBoundingClientRect()
  const position = calculateTooltipPosition(rect, tooltipContainer)

  tooltipContainer.style.position = "fixed"
  tooltipContainer.style.left = position.left
  tooltipContainer.style.top = position.top
}

/**
 * Debounces function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

const debouncedHover = debounce(handleMonkeHover, 100)

/**
 * Initializes mouse event listeners
 * Uses activeTab permission to track mouse position and update tooltip
 */
function initializeObserver() {
  // Track mouse movement for tooltip positioning
  document.addEventListener("mousemove", (event) => {
    if (event.clientX < 250 && event.clientY < 100) {
      hideTooltip()
      return
    }

    debouncedHover(event)
  })

  // Clean up tooltip when mouse leaves document
  document.addEventListener("mouseleave", hideTooltip)

  // Update tooltip position on scroll
  document.addEventListener("scroll", () => {
    if (!lastHoveredCard) {
      hideTooltip()
    }
  })
}

// Initialize extension
loadMetadata().then(() => {
  if (monkesData) {
    initializeObserver()
  }
})

