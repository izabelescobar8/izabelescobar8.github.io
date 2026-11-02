document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('district-search');
    const searchResults = document.getElementById('search-results');
    const resultContainer = document.getElementById('result-container');
    const districtNameHeading = document.getElementById('district-name');
    const ctx = document.getElementById('absenteeChart').getContext('2d');

    let districtData = [];
    let chartInstance = null;
    const yearMapping = {
        '20242025': '2024-2025',
        '20232024': '2023-2024',
        '20222023': '2022-2023',
        '20212022': '2021-2022',
        '20202021': '2020-2021',
        '20192020': '2019-2020'
    };
    
    // Sort years chronologically for the x-axis
    const orderedKeys = ['20192020', '20202021', '20212022', '20222023', '20232024', '20242025'];

    // Load and parse CSV
    Papa.parse('district_data.csv', {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            districtData = results.data;
            console.log('Data loaded:', districtData.length, 'records');
        },
        error: function(err) {
            console.error('Error loading CSV:', err);
        }
    });

    // Search functionality
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        searchResults.innerHTML = '';
        
        if (query.length < 2) {
            searchResults.classList.add('hidden');
            return;
        }

        const matches = districtData.filter(row => 
            row.clean_name && row.clean_name.toLowerCase().includes(query)
        );

        if (matches.length > 0) {
            matches.slice(0, 10).forEach(match => {
                const div = document.createElement('div');
                div.className = 'search-item';
                div.textContent = match.clean_name;
                div.addEventListener('click', () => {
                    selectDistrict(match);
                });
                searchResults.appendChild(div);
            });
            searchResults.classList.remove('hidden');
        } else {
            searchResults.classList.add('hidden');
        }
    });

    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.classList.add('hidden');
        }
    });

    function selectDistrict(district) {
        searchInput.value = district.clean_name;
        searchResults.classList.add('hidden');
        resultContainer.classList.remove('hidden');
        districtNameHeading.textContent = district.clean_name;
        
        updateChart(district);
    }

    function updateChart(district) {
        const labels = orderedKeys.map(key => yearMapping[key]);
        const dataPoints = orderedKeys.map(key => {
            const val = district[key];
            return (val === 'NA' || val === '' || val === undefined) ? null : parseFloat(val);
        });

        if (chartInstance) {
            chartInstance.destroy();
        }

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Chronic Absenteeism Rate (%)',
                    data: dataPoints,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    borderWidth: 3,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#2563eb',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    fill: true,
                    tension: 0.3, // smooth curves
                    spanGaps: true // connect lines across nulls (optional, set false if gaps desired)
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        padding: 12,
                        titleFont: {
                            family: 'Inter',
                            size: 14
                        },
                        bodyFont: {
                            family: 'Inter',
                            size: 14
                        },
                        callbacks: {
                            label: function(context) {
                                return `Rate: ${context.parsed.y}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Percent (%)',
                            font: {
                                family: 'Inter',
                                weight: 600
                            }
                        },
                        grid: {
                            color: '#e2e8f0',
                            borderDash: [5, 5]
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'School Year',
                            font: {
                                family: 'Inter',
                                weight: 600
                            }
                        },
                        grid: {
                            display: false
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index',
                },
            }
        });
    }
});
