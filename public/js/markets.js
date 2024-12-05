document.addEventListener('DOMContentLoaded', function() {
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Handle trade button clicks
    const tradeButtons = document.querySelectorAll('.btn-primary');
    tradeButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            const row = e.target.closest('tr');
            const symbol = row.cells[0].textContent;
            const price = row.cells[2].textContent;
            // You can implement the trade modal or navigation here
            console.log(`Trading ${symbol} at ${price}`);
        });
    });

    // Handle filter button click
    const filterButton = document.querySelector('.market-filters .btn:first-child');
    if (filterButton) {
        filterButton.addEventListener('click', function() {
            // Implement filter functionality
            console.log('Filter clicked');
        });
    }

    // Handle sort button click
    const sortButton = document.querySelector('.market-filters .btn:last-child');
    if (sortButton) {
        sortButton.addEventListener('click', function() {
            // Implement sort functionality
            console.log('Sort clicked');
        });
    }
});
