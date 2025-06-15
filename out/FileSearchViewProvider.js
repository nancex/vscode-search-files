"use strict";
// src/FileSearchViewProvider.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSearchViewProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
class FileSearchViewProvider {
    _extensionUri;
    static viewType = 'search-files.file-searcher.view'; // Must match the ID in package.json
    _view;
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'search':
                    {
                        if (!data.value) {
                            webviewView.webview.postMessage({ type: 'results', results: [] });
                            return;
                        }
                        // Fetch all files and then filter them in the extension host
                        // to ensure consistent filtering logic across all platforms.
                        const allFiles = await vscode.workspace.findFiles('**/*');
                        const searchResults = allFiles.filter(file => {
                            const fileName = path.basename(file.fsPath);
                            if (data.useRegex) {
                                try {
                                    const regex = new RegExp(data.value, data.caseSensitive ? '' : 'i');
                                    return regex.test(fileName);
                                }
                                catch (e) {
                                    // Invalid regex, don't filter anything
                                    return false;
                                }
                            }
                            else {
                                if (data.caseSensitive) {
                                    return fileName.includes(data.value);
                                }
                                else {
                                    return fileName.toLowerCase().includes(data.value.toLowerCase());
                                }
                            }
                        }).map(file => {
                            return {
                                uri: file.toString(),
                                label: path.basename(file.fsPath),
                                description: vscode.workspace.asRelativePath(file)
                            };
                        });
                        webviewView.webview.postMessage({ type: 'results', results: searchResults });
                        break;
                    }
                case 'openFile':
                    {
                        const uri = vscode.Uri.parse(data.uri);
                        vscode.workspace.openTextDocument(uri).then(doc => {
                            vscode.window.showTextDocument(doc);
                        });
                        break;
                    }
            }
        });
    }
    _getHtmlForWebview(webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
        const nonce = getNonce();
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleVSCodeUri}" rel="stylesheet">
                <title>File Name Search</title>
            </head>
            <body>
                <div id="search-container">
                    <input type="text" id="search-input" placeholder="Enter file name to search...">
                    <div class="search-controls">
                        <div class="control-button" id="case-sensitive-toggle" title="Match Case">Aa</div>
                        <div class="control-button" id="regex-toggle" title="Use Regular Expression">.*</div>
                    </div>
                </div>

                <div id="results-container"></div>

                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}
exports.FileSearchViewProvider = FileSearchViewProvider;
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
//# sourceMappingURL=FileSearchViewProvider.js.map