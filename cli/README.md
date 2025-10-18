# 🗑️ tsbin (Trashbin) Command-Line Interface (CLI) Documentation

**tsbin** is a minimal, secure command-line tool for temporary, end-to-end encrypted file and text snippet sharing. It is designed to be a "digital trashbin" where shared content automatically expires.

## 🚀 1. Overview and Core Features

The `tsbin` CLI is the primary way to interact with the service. All encryption and decryption happen locally on your machine.

### Key Features

  * **End-to-End Encryption (E2EE):** Files and snippets are encrypted locally before transmission and decrypted only upon download.
  * **Simple Commands:** Focused on three main actions: `up` (upload), `down` (download), and `snip` (snippet).
  * **Passcode Protection:** Optionally secure uploads with a passcode, which is required for decryption.
  * **Decentralized Storage:** Files are stored on Telegram using a Bot, and metadata is managed via Appwrite.

## ⚙️ 2. Installation and Setup

### Prerequisites

To use `tsbin`, you must have:

  * **Node.js** (v18 or higher).
  * An operational **Telegram Bot** token.
  * An **Appwrite** server instance with a project ID and API key.

### CLI Installation

To run `tsbin`, clone the repository and execute the main script using `node` or `npx`:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/arnav-terex/tsbin.git
    cd tsbin
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```
3.  The CLI is executed via the `tsbin.js` file:
    ```bash
    node tsbin.js <command> [options]
    # For simplicity, this documentation will use 'tsbin' as a placeholder.
    ```

### Configuration (`.env` File)

The CLI requires sensitive credentials to communicate with Telegram and Appwrite. These must be defined in a **`.env`** file in the project's root directory.

| Variable | Description | Source |
| :--- | :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | Your unique token from Telegram's BotFather. This is used for file storage. | |
| `APPWRITE_ENDPOINT` | The URL for your Appwrite server. | |
| `APPWRITE_PROJECT_ID` | The ID of your Appwrite project. | |
| `APPWRITE_API_KEY` | An API key created in your Appwrite console for server-side access. | |
| `APPWRITE_DATABASE_ID` | The ID of the database you have set up in Appwrite. | |
| `APPWRITE_COLLECTION_ID` | The ID of the collection within the database where metadata is stored. | |

**Example `.env.example` content:**

```
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
APPWRITE_ENDPOINT=http://localhost/v1
APPWRITE_PROJECT_ID=659a8523362a74423405
APPWRITE_API_KEY=eyJra...
APPWRITE_DATABASE_ID=659a856f643e2329759d
APPWRITE_COLLECTION_ID=659a8576d1e4e460d032
```

> **Action:** Copy `template.env` to `.env` and fill in your values.

-----

## 💻 3. CLI Usage and Commands

The CLI structure is based on a primary command followed by specific arguments and options.

### Global Commands

| Command | Alias | Description |
| :--- | :--- | :--- |
| `node tsbin.js help` | `h` | Displays the help message and command syntax. |

### 3.1. `upload` Command

Encrypts a file and uploads it to Telegram storage, then stores the metadata on Appwrite.

**Syntax:**

```bash
node tsbin.js upload <path/to/file> [options]
```

| Option | Alias | Description | Type |
| :--- | :--- | :--- | :--- |
| `--passcode` | `-p` | **Optional.** A passcode (secret key) used for symmetric encryption of the file. This passcode is required for decryption. | `string` |
| `--expiry` | `-e` | **Optional.** Sets the time until the file expires (e.g., `1h`, `24h`, `7d`). *(Planned)*. | `string` |

**Example: Encrypt and upload a PDF with a 4-digit passcode**

```bash
node tsbin.js upload ./confidential.pdf --passcode 1234
# Output:
# File Encrypted and Uploaded!
# ID: 65b1234567890abcdef0001
# Share Link: [Your Appwrite Endpoint]/f/65b1234567890abcdef0001
```

### 3.2. `download` Command

Retrieves the encrypted file from Telegram using the ID, downloads it, and decrypts it locally.

**Syntax:**

```bash
node tsbin.js download <file-id> [options]
```

| Option | Alias | Description | Type |
| :--- | :--- | :--- | :--- |
| `--passcode` | `-p` | **Mandatory if file is protected.** The secret key required to decrypt the file. | `string` |

**Example: Download and decrypt the protected file**

```bash
node tsbin.js download 65b1234567890abcdef0001 --passcode 1234
# Output:
# File 65b1234567890abcdef0001 downloaded and decrypted successfully as confidential.pdf
```

### 3.3. `snippet` Command

Encrypts a short string of text and uploads it as a text snippet. The snippet is stored as a small file.

**Syntax:**

```bash
node tsbin.js snippet "<text/string>" [options]
```

| Option | Alias | Description | Type |
| :--- | :--- | :--- | :--- |
| `--passcode` | `-p` | **Optional.** A passcode for securing the text snippet. | `string` |

**Example: Sharing a temporary API key**

```bash
node tsbin.js snippet "API_SECRET=a1b2c3d4e5f6" -p key-access
# Output:
# Snippet Encrypted and Uploaded!
# ID: 65b1234567890abcdef0002
# Share Link: [Your Appwrite Endpoint]/s/65b1234567890abcdef0002
```

### 3.4. `decryptSnippet` Command

Retrieves and decrypts an encrypted text snippet, displaying the result to the console.

**Syntax:**

```bash
node tsbin.js decryptSnippet <snippet-id> [options]
```

| Option | Alias | Description | Type |
| :--- | :--- | :--- | :--- |
| `--passcode` | `-p` | **Mandatory if snippet is protected.** The secret key used during upload. | `string` |

**Example: Decrypting and viewing the shared key**

```bash
node tsbin.js decryptSnippet 65b1234567890abcdef0002 -p key-access
# Output:
# Decrypting Snippet...
# Snippet Content: API_SECRET=a1b2c3d4e5f6
```

-----

## 🚧 4. Troubleshooting and FAQs

### Common Issues

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **`Error: TELEGRAM_BOT_TOKEN not set`** | Missing or incorrect variable in your `.env` file. | Ensure you have copied `template.env` to `.env` and all required environment variables are set correctly. |
| **`Download failed: Invalid Passcode`** | The wrong passcode was provided during the `download` or `decryptSnippet` command. | Verify the exact passcode used for the original `upload` or `snippet` command. The passcode is the decryption key. |
| **`Error: Decryption failed`** | Incorrect key size or corrupted file/data during download. | Check the passcode. If the file was downloaded manually outside of the CLI, ensure it is the exact raw data from Telegram. |
| **`Appwrite connection failed`** | Incorrect `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, or `APPWRITE_API_KEY`. | Double-check all Appwrite credentials and ensure your Appwrite server is running and accessible. |
| **File is not available after expiry** | The file's configured expiry time has been reached. | The file is permanently deleted from storage. You must re-upload the file. |

### Security FAQ

**Q: Where are my files stored?**
A: Encrypted files are stored on **Telegram** using your Bot's API. Metadata (like file ID and filename) is stored on your **Appwrite** instance.

**Q: Can the service providers (Telegram, Appwrite) read my files?**
A: **No.** Files are encrypted on your local machine *before* being uploaded to Telegram. Neither Telegram nor the Appwrite metadata service holds the key required for decryption.

**Q: Is the passcode required?**
A: No, but it is highly recommended. The passcode serves as the symmetric encryption key. If no passcode is provided, a key is likely generated locally for E2EE, but the use of a unique, memorable passcode adds a layer of protection against unauthorized access.