// media/main.js

(function () {
    const vscode = acquireVsCodeApi();

    const searchInput = document.getElementById('search-input');
    const resultsContainer = document.getElementById('results-container');
    const caseToggle = document.getElementById('case-sensitive-toggle');
    const regexToggle = document.getElementById('regex-toggle');

    let searchTimeout;
    let isCaseSensitive = false;
    let useRegex = false;

    function triggerSearch() {
        // Debounce search to avoid excessive API calls
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const query = searchInput.value;
            vscode.postMessage({
                type: 'search',
                value: query,
                caseSensitive: isCaseSensitive,
                useRegex: useRegex
            });
        }, 10); // Reduced delay for more responsive feel
    }

    searchInput.addEventListener('input', triggerSearch);

    caseToggle.addEventListener('click', () => {
        isCaseSensitive = !isCaseSensitive;
        caseToggle.classList.toggle('active', isCaseSensitive);
        triggerSearch(); // Re-run search with new setting
    });
    
    regexToggle.addEventListener('click', () => {
        useRegex = !useRegex;
        regexToggle.classList.toggle('active', useRegex);
        triggerSearch(); // Re-run search with new setting
    });

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'results':
                resultsContainer.innerHTML = ''; // Clear previous results
                if (!message.results || message.results.length === 0) {
                    return;
                }

                message.results.forEach(file => {
                    const item = document.createElement('div');
                    item.className = 'result-item';
                    item.dataset.uri = file.uri;

                    const label = document.createElement('div');
                    label.className = 'result-label';
                    label.textContent = file.label;

                    const description = document.createElement('div');
                    description.className = 'result-description';
                    description.textContent = file.description;
                    
                    item.appendChild(label);
                    item.appendChild(description);

                    item.addEventListener('click', () => {
                        // Provide click feedback
                        const currentlyClicked = document.querySelector('.result-item.clicked');
                        if (currentlyClicked) {
                            currentlyClicked.classList.remove('clicked');
                        }
                        item.classList.add('clicked');
                        
                        // Send message to open the file
                        vscode.postMessage({
                            type: 'openFile',
                            uri: item.dataset.uri
                        });
                    });
                    resultsContainer.appendChild(item);
                });
                break;
        }
    });

}());