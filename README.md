# Twitter Scrapper Chrome Extension


A simple and lightweight Chrome extension to scrape tweet data from your current Twitter timeline and export it into a clean CSV file.

## Features

-   **One-Click Scraping**: Easily initiate the scraping process from the extension popup.
-   **Structured Data**: Extracts key information from each tweet, including user details, text, engagement stats, and a direct link.
-   **CSV Export**: Downloads the scraped data in a universally compatible CSV format, ready for analysis.
-   **Lightweight**: No unnecessary permissions or background processes. It only runs when you ask it to.

---

## Data Scraped

The extension is designed to scrape the following fields for each tweet loaded on the page:

| Column Header | Description                                     |
|---------------|-------------------------------------------------|
| `User`        | The display name of the user who posted the tweet. |
| `Handle`      | The user's unique Twitter handle (e.g., `@twitter`). |
| `Timestamp`   | The exact date and time the tweet was posted.         |
| `Tweet Text`  | The full text content of the tweet.             |
| `Replies`     | The total number of replies.             |
| `Retweets`    | The total number of retweets.                         |
| `Likes`       | The total number of likes.                            |
| `Tweet URL`   | The direct permalink to the individual tweet.              |

---

## Installation

This extension is not published on the Chrome Web Store. To install it, you need to load it manually in developer mode.

1.  **Download the Repository**
    *   Click the green **`< > Code`** button on this page.
    *   Select **`Download ZIP`**.
    *   Unzip the downloaded file (`twitter-scrapper-main.zip`) to a location you can easily find.

2.  **Load the Extension in Chrome**
    *   Open Google Chrome and navigate to the extensions page by typing `chrome://extensions` in the address bar and pressing Enter.
    *   In the top-right corner, enable **`Developer mode`** using the toggle switch.
    *   Three new buttons will appear. Click on **`Load unpacked`**.
    *   A file browser will open. Navigate to and select the folder you unzipped in step 1 (the one containing `manifest.json`).
    *   The "Twitter Scrapper" extension will now appear in your list of extensions and you can pin it to your toolbar for easy access.

---

## How to Use

1.  **Navigate to Twitter**: Go to `https://twitter.com` in your Chrome browser.
2.  **Load Tweets**: Scroll down the page to load as many tweets as you wish to scrape. The extension can only see the tweets that are currently rendered on the page.
3.  **Open the Extension**: Click the Twitter Scrapper icon in your browser's toolbar.
4.  **Start Scraping**: Click the **`Scrap Data`** button. The button text will change to "Scraping..." while it processes the tweets.
5.  **Download Data**: Once scraping is complete, the **`Download CSV`** button will become enabled. Click it to save the `twitter_data.csv` file to your computer.

---

## Technical Details

This extension works by injecting a content script (`content.js`) into the active Twitter tab.

-   **`popup.js`**: Manages the user interface of the extension's popup and sends messages to the content script.
-   **`content.js`**: Listens for messages and then queries the page's Document Object Model (DOM) using `data-testid` attributes to find and extract data from each tweet element.
-   **`background.js`**: A simple service worker that facilitates communication between the popup and the content script.
-   **Chrome APIs**:
    -   `chrome.storage`: Used to temporarily store the scraped data array before it is downloaded.
    -   `chrome.downloads`: Used to trigger the download of the final CSV file.

---

## Disclaimer

-   **Reliant on Twitter's UI**: This scraper depends on the specific HTML structure and `data-testid` attributes used by Twitter. Twitter frequently updates its website, which **will break this extension**. If it stops working, the selectors in `content.js` likely need to be updated.
-   **Terms of Service**: Be aware that automated data collection may violate Twitter's Terms of Service. Use this tool responsibly and at your own risk.

## Contributing

Feel free to fork this repository, make improvements, and submit a pull request. If you find a bug or have a feature request, please open an issue.
