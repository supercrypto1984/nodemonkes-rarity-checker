/**
 * NodeMonkes Rarity Checker - Background Script
 *
 * Purpose:
 * This background script handles the loading and caching of NodeMonkes NFT metadata.
 * It serves as a central data manager for the extension.
 *
 * Privacy Notice:
 * - No user data is collected or stored
 * - Only loads local metadata file included with the extension
 * - No external API calls or data transmission
 *
 * Permission Usage:
 * - Uses chrome.runtime.getURL to access local extension files
 * - No additional permissions required for background operations
 */

let monkesData = null

/**
 * Loads NodeMonkes metadata from the local extension file
 * This function only accesses the included metadata.json file
 * @returns {Promise<Array>} Array of NodeMonkes metadata
 */
async function fetchMonkesData() {
  try {
    // Load metadata from local extension file
    const response = await fetch(chrome.runtime.getURL("metadata.json"))
    if (!response.ok) throw new Error("Failed to fetch monkes data")
    const data = await response.json()
    monkesData = data
    return data
  } catch (error) {
    console.error("Error fetching monkes data:", error)
    return null
  }
}

/**
 * Retrieves metadata for a specific NodeMonke by inscription number
 * @param {string|number} inscriptionNumber - The inscription number to look up
 * @returns {Promise<Object|null>} NodeMonke metadata object or null if not found
 */
async function getMonkeByInscription(inscriptionNumber) {
  if (!monkesData) {
    await fetchMonkesData()
  }

  if (!monkesData) return null

  return monkesData.find((monke) => monke.inscription === Number.parseInt(inscriptionNumber))
}

// Initialize message listener for content script communication
if (typeof chrome !== "undefined" && chrome.runtime) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "GET_MONKE_DATA") {
      getMonkeByInscription(request.inscriptionNumber)
        .then((monkeData) => {
          sendResponse({ success: true, data: monkeData })
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message })
        })
      return true // Keep message channel open for async response
    }
  })
}

