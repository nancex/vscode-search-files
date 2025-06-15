// src/FileSearchViewProvider.ts

import * as vscode from 'vscode';
import * as path from 'path';

export class FileSearchViewProvider implements vscode.WebviewViewProvider {

    public static readonly viewType = 'search-files.file-searcher.view'; // Must match the ID in package.json

    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
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
                                } catch (e) {
                                    // Invalid regex, don't filter anything
                                    return false;
                                }
                            } else {
                                if (data.caseSensitive) {
                                    return fileName.includes(data.value);
                                } else {
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

    private _getHtmlForWebview(webview: vscode.Webview) {
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

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}