// Watchlist functionality
document.addEventListener('DOMContentLoaded', function() {
    // Add stock form submission
    const addStockForm = document.getElementById('add-stock-form');
    if (addStockForm) {
        addStockForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const symbol = document.getElementById('stock-symbol').value.toUpperCase();
            
            try {
                const response = await fetch('/watchlist/add', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ symbol })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showNotification('Stock added successfully', 'success');
                    setTimeout(() => window.location.reload(), 1000);
                } else {
                    showNotification(data.message || 'Failed to add stock', 'error');
                }
            } catch (error) {
                console.error('Error adding stock:', error);
                showNotification('Failed to add stock', 'error');
            }
        });
    }

    // Remove stock buttons
    document.querySelectorAll('.remove-stock-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const symbol = this.dataset.symbol;
            
            if (!confirm(`Are you sure you want to remove ${symbol} from your watchlist?`)) {
                return;
            }
            
            try {
                const response = await fetch('/watchlist/remove', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ symbol })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showNotification('Stock removed successfully', 'success');
                    const row = document.getElementById(`stock-${symbol}`);
                    if (row) {
                        row.remove();
                        checkEmptyWatchlist();
                    }
                } else {
                    showNotification(data.message || 'Failed to remove stock', 'error');
                }
            } catch (error) {
                console.error('Error removing stock:', error);
                showNotification('Failed to remove stock', 'error');
            }
        });
    });

    // Refresh watchlist button
    const refreshButton = document.getElementById('refresh-watchlist');
    if (refreshButton) {
        refreshButton.addEventListener('click', async function() {
            const icon = this.querySelector('.refresh-icon');
            icon.classList.add('spinning');
            
            try {
                const response = await fetch('/watchlist/refresh', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showNotification('Watchlist refreshed', 'success');
                    updateWatchlistPrices(data.stocks);
                } else {
                    showNotification(data.message || 'Failed to refresh watchlist', 'error');
                }
            } catch (error) {
                console.error('Error refreshing watchlist:', error);
                showNotification('Failed to refresh watchlist', 'error');
            } finally {
                icon.classList.remove('spinning');
            }
        });
    }

    // WebSocket connection for real-time updates
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    
    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        if (data.type === 'price_update') {
            updateStockPrice(data.symbol, data.price, data.change);
        }
    };

    ws.onerror = function(error) {
        console.error('WebSocket error:', error);
        showNotification('Lost connection to real-time updates', 'error');
    };

    ws.onclose = function() {
        showNotification('Connection to real-time updates closed', 'warning');
        // Try to reconnect after 5 seconds
        setTimeout(() => {
            window.location.reload();
        }, 5000);
    };

    // Helper function to update stock prices in UI
    function updateStockPrice(symbol, price, change) {
        const row = document.getElementById(`stock-${symbol}`);
        if (row) {
            const priceElement = row.querySelector('.price-value');
            const changeElement = row.querySelector('.price-change');
            const lastUpdatedElement = row.querySelector('.last-updated');
            
            if (priceElement) {
                const oldPrice = parseFloat(priceElement.textContent.replace('$', ''));
                priceElement.textContent = `$${price.toFixed(2)}`;
                priceElement.classList.add(price > oldPrice ? 'flash-green' : 'flash-red');
                setTimeout(() => {
                    priceElement.classList.remove('flash-green', 'flash-red');
                }, 1000);
            }
            
            if (changeElement) {
                const changeText = change >= 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`;
                changeElement.textContent = changeText;
                changeElement.className = `price-change ${change >= 0 ? 'positive' : 'negative'}`;
            }
            
            if (lastUpdatedElement) {
                lastUpdatedElement.textContent = new Date().toLocaleString();
            }
        }
    }

    // Helper function to update multiple stock prices
    function updateWatchlistPrices(stocks) {
        stocks.forEach(stock => {
            updateStockPrice(stock.symbol, stock.lastPrice, stock.priceChange);
        });
    }

    // Helper function to check for empty watchlist
    function checkEmptyWatchlist() {
        const tbody = document.querySelector('.watchlist-table tbody');
        if (tbody && tbody.children.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        <div class="empty-watchlist">
                            <i class="fas fa-search mb-3"></i>
                            <h3>Your watchlist is empty</h3>
                            <p>Start by adding some stocks to track!</p>
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    // Helper function to show notifications
    function showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Animate out
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Auto-refresh prices every minute
    setInterval(() => {
        if (document.visibilityState === 'visible') {
            refreshButton.click();
        }
    }, 60000);
});
