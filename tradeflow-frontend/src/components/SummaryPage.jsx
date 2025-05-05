import React, {useEffect, useState, useMemo, useCallback} from "react";
import {
    Container,
    Typography,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    TableFooter,
    TableContainer,
    Paper,
    TextField,
    TableSortLabel,
    CircularProgress,
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Checkbox,
    ListItemText,
    FormControlLabel,
    Button,
    Drawer,
    IconButton,
    Menu,
    Chip,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import {jsPDF} from "jspdf";
import html2canvas from "html2canvas";

// Helper to get API URL
const API_URL = process.env.REACT_APP_API_URL || "";

// Utility function for formatting numbers
const formatNumber = (num, decimals = 2, locale = "en-US") => {
    // Handle null/undefined input gracefully
    if (num == null || isNaN(Number(num))) {
        return "N/A"; // Or return 0, or empty string, depending on desired display
    }
    return Number(num).toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

// Custom hook to handle sorting logic
const useSortableData = (items, initialConfig = {key: "netQuantity", direction: "desc"}) => {
    const [sortConfig, setSortConfig] = useState(initialConfig);

    const sortedItems = useMemo(() => {
        // Ensure items is treated as an array, default to empty array if not iterable/array
        const safeItems = Array.isArray(items) ? items : [];
        const sortable = [...safeItems]; // Spread the guaranteed array

        if (sortConfig !== null) {
            sortable.sort((a, b) => {
                let aValue, bValue;

                // Use custom sortValue function if provided in config, otherwise use key directly
                if (sortConfig.sortValue && typeof sortConfig.sortValue === 'function') {
                    aValue = sortConfig.sortValue(a) ?? ""; // Use nullish coalescing for undefined/null
                    bValue = sortConfig.sortValue(b) ?? "";
                } else {
                    aValue = a[sortConfig.key] ?? "";
                    bValue = b[sortConfig.key] ?? "";
                }

                if (typeof aValue === "number" && typeof bValue === "number") {
                    // Handle potential NaN values by treating them as 0 or placing them consistently
                    aValue = isNaN(aValue) ? -Infinity : aValue; // Or 0, or Infinity depending on desired placement
                    bValue = isNaN(bValue) ? -Infinity : bValue;
                    return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
                }
                // String comparison
                return sortConfig.direction === "asc"
                    ? String(aValue).localeCompare(String(bValue))
                    : String(bValue).localeCompare(String(aValue));
            });
        }
        return sortable;
    }, [items, sortConfig]);

    const requestSort = useCallback(
        (key, sortValueFunc = null) => { // Accept optional sortValue function
            let direction = "asc";
            if (sortConfig.key === key && sortConfig.direction === "asc") {
                direction = "desc";
            }
            // Store the key, direction, and the sortValue function in the config
            setSortConfig({key, direction, sortValue: sortValueFunc});
        },
        [sortConfig] // Dependency remains sortConfig
    );

    return {items: sortedItems, sortConfig, requestSort};
};

// Main Component
function SummaryPage() {
    const [holdingsData, setHoldingsData] = useState([]);
    const [aggregateData, setAggregateData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [aggLoading, setAggLoading] = useState(true);
    const [priceUpdatesLaunched, setPriceUpdatesLaunched] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedPositions, setSelectedPositions] = useState(["open", "closed"]);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [darkMode, setDarkMode] = useState(false);
    const [highlightSignificant, setHighlightSignificant] = useState(true);

    // State for the right settings drawer
    const [drawerOpen, setDrawerOpen] = useState(false);

    // State for columns filter menu (3-dots)
    const [columnsMenuAnchor, setColumnsMenuAnchor] = useState(null);
    const handleColumnsMenuOpen = (event) => {
        setColumnsMenuAnchor(event.currentTarget);
    };
    const handleColumnsMenuClose = () => {
        setColumnsMenuAnchor(null);
    };

    // Centralized color definitions – all dark/light mode decisions are handled here.
    const colors = {
        text: darkMode ? "white" : "black",
        background: darkMode ? "#333" : "white",
        border: darkMode ? "white" : "black",
        positive: darkMode ? "#90ee90" : "green",
        negative: darkMode ? "#ff7f7f" : "red",
        highlight: darkMode ? "#675723" : "#fff5c5",
        outerBackground: darkMode ? "#222" : "inherit",
    };

    // Define columns configuration - Revert to previous structure + status
    const columns = [
        {
            key: "ticker",
            label: "Ticker",
            alwaysVisible: true,
            defaultVisible: true,
            sortable: true,
        },
        {
            key: "tradeSource",
            label: "Source / Owner",
            defaultVisible: true,
            format: (row) => `${row.source?.name || 'N/A'}${row.owner?.name ? ` (${row.owner.name})` : ""}`,
            sortable: true,
            sortValue: (row) => `${row.source?.name || ''}${row.owner?.name || ''}`.toLowerCase(),
        },
        {
            key: "status",
            label: "Status",
            defaultVisible: true,
            format: (row) => (
                 <Chip
                    // Determine status based on netQuantity again for display consistency
                    label={Number(row.netQuantity) === 0 ? 'CLOSED' : 'OPEN'}
                    color={Number(row.netQuantity) === 0 ? 'default' : 'success'}
                    size="small"
                    variant="outlined"
                 />
            ),
            sortable: true,
            // Sort based on quantity (0 vs non-zero)
            sortValue: (row) => Number(row.netQuantity) === 0 ? 1 : 0, // Sort closed after open
        },
        {
            key: "netQuantity",
            label: "Net Qty",
            defaultVisible: false,
            format: (row) => formatNumber(row.netQuantity, 2),
            sortable: true,
        },
        {
            key: "netCost",
            label: "Net Cost",
            defaultVisible: true,
            format: (row) => `$${formatNumber(row.netCost)}`,
            sortable: true,
        },
        {
            key: "averageCost",
            label: "Avg Cost",
            defaultVisible: false,
            format: (row) => `$${formatNumber(row.averageCost)}`,
            sortable: true,
        },
        // Restore frontend calculated columns
        {
            key: "currentPrice",
            label: "Current Price",
            defaultVisible: true,
            format: (row) =>
                row.updating ? (
                    <CircularProgress size={16}/>
                ) : row.currentPrice != null ? (
                    `$${formatNumber(row.currentPrice)}`
                ) : (
                    // Display last trade price for closed or N/A if unavailable
                    row.netQuantity === 0 ? `$${formatNumber(row.latestTradePrice)}` : '-'
                ),
            sortable: true,
        },
        {
            key: "currentMarketValue",
            label: "Market Value",
            defaultVisible: true,
            format: (row) => {
                 const value = row.netQuantity != null && row.currentPrice != null ? row.netQuantity * row.currentPrice : null;
                 return value != null ? `$${formatNumber(value)}` : (row.netQuantity === 0 ? "$0.00" : "-") ;
            },
            sortable: true,
            sortValue: (row) => (row.netQuantity != null && row.currentPrice != null) ? (row.netQuantity * row.currentPrice) : (row.netQuantity === 0 ? 0 : null),
        },
        {
            key: "unrealizedPnl",
            label: "Unrealized P/L",
            defaultVisible: false,
            format: (row) => {
                // *** Add Logging ***
                console.log(`[${row.ticker}] Formatter Check (Unrealized P/L): updating=${row.updating}, netQuantity=${row.netQuantity}, Should Show Spinner: ${row.updating && row.netQuantity !== 0}`);
                const pnl = row.unrealizedPnl;
                return row.updating && row.netQuantity !== 0? (
                    <CircularProgress size={16}/>
                ) : pnl != null ? (
                    <span style={{color: pnl >= 0 ? colors.positive : colors.negative}}>
                        ${formatNumber(pnl)}
                    </span>
                ) : (
                    <span style={{color: "lightgray"}}>-</span>
                )
            },
            sortable: true,
            sortValue: (row) => row.unrealizedPnl,
        },
        {
            key: "unrealizedPnlPercentage",
            label: "Unrealized P/L %",
            defaultVisible: false,
            format: (row) => {
                const pnlPerc = row.unrealizedPnlPercentage;
                 return row.updating && row.netQuantity !== 0 ? (
                    <CircularProgress size={16}/>
                ) : pnlPerc != null ? (
                    <span style={{color: pnlPerc >= 0 ? colors.positive : colors.negative}}>
                        {formatNumber(pnlPerc)}%
                    </span>
                ) : (
                     <span style={{color: "lightgray"}}>-</span>
                )
            },
            sortable: true,
            sortValue: (row) => row.unrealizedPnlPercentage,
            footer: () => "",
        },
        {
            key: "totalProfit",
            label: "Total Profit",
            defaultVisible: true,
            format: (row) => {
                const pnl = row.totalProfit;
                return row.updating && row.netQuantity !== 0 ? (
                    <CircularProgress size={16}/>
                ) : pnl != null ? (
                    <span style={{color: pnl >= 0 ? colors.positive : colors.negative}}>
                        ${formatNumber(pnl)}
                    </span>
                ) : (
                    <span style={{color: "lightgray"}}>-</span>
                )
            },
            sortable: true,
            sortValue: (row) => row.totalProfit,
        },
        {
            key: "totalProfitPercentage",
            label: "Total Profit %",
            defaultVisible: true,
            format: (row) => {
                const pnlPerc = row.totalProfitPercentage;
                return row.updating && row.netQuantity !== 0 ? (
                    <CircularProgress size={16}/>
                ) : pnlPerc != null ? (
                    <span style={{color: pnlPerc >= 0 ? colors.positive : colors.negative}}>
                        {formatNumber(pnlPerc)}%
                    </span>
                ) : (
                    <span style={{color: "lightgray"}}>-</span>
                )
            },
            sortable: true,
            sortValue: (row) => row.totalProfitPercentage,
        },
        {
            key: "changeToday",
            label: "Day Change",
            defaultVisible: true,
            format: (row) =>
                // Only show for open positions
                row.netQuantity !== 0 && row.changeToday != null ? (
                    <span style={{color: row.changeToday >= 0 ? colors.positive : colors.negative}}>
                        ${formatNumber(row.changeToday * (row.netQuantity || 0) )}
                    </span>
                ) : (
                    <span style={{color: "lightgray"}}>-</span>
                ),
            sortable: true,
            // Sort by amount * quantity for open positions
            sortValue: (row) => row.netQuantity !== 0 && row.changeToday != null ? (row.changeToday * row.netQuantity) : null,
        },
        {
            key: "changeTodayPercentage",
            label: "Day Change %",
            defaultVisible: true,
            format: (row) =>
                 // Only show for open positions
                row.netQuantity !== 0 && row.changeTodayPercentage != null ? (
                    <span style={{color: row.changeTodayPercentage >= 0 ? colors.positive : colors.negative}}>
                        {formatNumber(row.changeTodayPercentage)}%
                    </span>
                ) : (
                     <span style={{color: "lightgray"}}>-</span>
                ),
            sortable: true,
        },
        {
            key: "holdingPeriod",
            label: "Holding (Days)",
            defaultVisible: false,
            sortable: true,
        },
        {
            key: "tradeCount",
            label: "# Trades",
            defaultVisible: false,
            format: (row) => formatNumber(row.tradeCount, 0), // Format as integer
            sortable: true,
        },
    ];

    // Control which columns are visible.
    const [visibleColumns, setVisibleColumns] = useState(
        columns.reduce((acc, col) => {
            acc[col.key] = col.defaultVisible;
            return acc;
        }, {})
    );

    // Fetch holdings and summary data
    useEffect(() => {
        setLoading(true);
        setAggLoading(true);

        Promise.all([
            fetch(`${API_URL}/holdings`).then(res => {
                if (!res.ok) return Promise.reject(`Holdings fetch failed: ${res.status}`);
                return res.json();
            }),
            fetch(`${API_URL}/holdings-summary`).then(res => {
                 if (!res.ok) return Promise.reject(`Summary fetch failed: ${res.status}`);
                 return res.json();
            })
        ])
        .then(([holdingsDataFromApi, summaryDataFromApi]) => {
            // Add initial 'updating' state for frontend calculations
            const initialHoldings = (Array.isArray(holdingsDataFromApi) ? holdingsDataFromApi : []).map(h => ({ ...h, updating: false }));
            setHoldingsData(initialHoldings);
            setAggregateData(summaryDataFromApi);
        })
        .catch((err) => {
            console.error("Error fetching initial page data:", err);
        })
        .finally(() => {
            setLoading(false);
            setAggLoading(false);
        });
    }, []);

    // Auto-refresh logic
    useEffect(() => {
        let intervalId;
        if (autoRefresh) {
            console.info("Auto-refresh enabled. Fetching data every 30 seconds.");
            const fetchData = () => {
                console.debug("Auto-refresh triggered: fetching /holdings and /holdings-summary");
                // Fetch both holdings and summary data
                Promise.all([
                    fetch(`${API_URL}/holdings`).then(res => {
                        if (!res.ok) return Promise.reject(`Holdings fetch failed: ${res.status}`);
                        return res.json();
                    }),
                    fetch(`${API_URL}/holdings-summary`).then(res => {
                        if (!res.ok) return Promise.reject(`Summary fetch failed: ${res.status}`);
                        return res.json();
                    })
                ])
                .then(([holdingsJson, summaryJson]) => {
                    // Directly use the JSON data
                    return [holdingsJson, summaryJson];
                })
                .then(([holdingsDataFromApi, summaryDataFromApi]) => {
                    console.debug("Auto-refresh successful. Updating state.");
                    // Add initial 'updating' state for frontend calculations
                    const initialHoldings = (Array.isArray(holdingsDataFromApi) ? holdingsDataFromApi : []).map(h => ({ ...h, updating: false }));
                    setHoldingsData(initialHoldings);
                    // Update aggregate data as well
                    setAggregateData(summaryDataFromApi);
                    // Reset the flag to allow price updates for the new data
                    setPriceUpdatesLaunched(false);
                })
                .catch(err => {
                    console.error("Error during auto-refresh", err);
                });
            };

            fetchData(); // Initial fetch on enable
            intervalId = setInterval(fetchData, 30000); // 30 seconds
        } else {
            console.info("Auto-refresh disabled.");
        }

        // Cleanup function to clear the interval when the component unmounts or autoRefresh changes
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
                console.debug("Cleared auto-refresh interval.");
            }
        };
    }, [autoRefresh]);

    // Restore useEffect for price updates
    useEffect(() => {
        // Prevent updates if still loading initial data or already launched
        if (loading || !holdingsData.length || priceUpdatesLaunched) {
            return;
        }

        setPriceUpdatesLaunched(true); // Mark as launched for this data set
        console.debug("Launching price updates for holdings...");

        holdingsData.forEach((holding, index) => {
            // Only fetch for OPEN positions (netQuantity !== 0)
            if (Number(holding.netQuantity) !== 0) {
                // Set updating flag for this specific holding
                setHoldingsData((prev) => {
                    const newData = [...prev];
                    if (newData[index]) { // Check if index is still valid
                        newData[index] = { ...newData[index], updating: true };
                        // *** Add Logging ***
                        console.log(`[${holding.ticker}] Set updating = true`, newData[index]);
                    }
                    return newData;
                });

                fetch(`${API_URL}/stock-info/${holding.ticker}`)
                    .then(res => res.ok ? res.json() : Promise.reject(`Stock info fetch failed for ${holding.ticker}`))
                    .then((data) => {
                        const { lastPrice, changeToday, changeTodayPercentage } = data;
                        const avgCost = holding.averageCost;
                        const netQty = holding.netQuantity;
                        const netCost = holding.netCost;
                        // Data for total profit calculation (from /holdings endpoint)
                        const totalBuyCost = holding.totalBuyCost;
                        const totalSellValue = holding.totalSellValue;

                        // Calculate unrealized P/L based on fetched price
                        const unrealizedPnl = (lastPrice - avgCost) * netQty;
                        const unrealizedPnlPercentage = netCost && Math.abs(netCost) > 0.001
                            ? (unrealizedPnl / Math.abs(netCost)) * 100
                            : 0;

                        // Calculate total profit based on fetched price and historical totals
                        // Ensure totalBuyCost and totalSellValue are numbers, default to 0 if null/undefined
                        const safeTotalBuyCost = Number(totalBuyCost) || 0;
                        const safeTotalSellValue = Number(totalSellValue) || 0;
                        const currentMarketValue = lastPrice * netQty;
                        const totalProfit = (safeTotalSellValue + currentMarketValue) - safeTotalBuyCost;
                        const totalProfitPercentage = safeTotalBuyCost && Math.abs(safeTotalBuyCost) > 0.001
                            ? (totalProfit / safeTotalBuyCost) * 100
                            : (totalProfit === 0 ? 0 : null); // Show 0% if profit is 0, else N/A if cost is 0

                        // *** Add Detailed Logging Here ***
                        console.log(`[${holding.ticker}] Price Update & Calc:
  - Last Price: ${lastPrice}
  - Net Qty: ${netQty}
  - Avg Cost: ${avgCost}
  - From API -> totalBuyCost: ${totalBuyCost}, totalSellValue: ${totalSellValue}
  - Calculated -> safeTotalBuyCost: ${safeTotalBuyCost}, safeTotalSellValue: ${safeTotalSellValue}
  - Calculated -> currentMarketValue: ${currentMarketValue}
  - Calculated -> unrealizedPnl: ${unrealizedPnl}
  - Calculated -> totalProfit: ${totalProfit}`);
                        // *** End Logging ***

                        // Update the specific holding in the state
                        setHoldingsData((prev) => {
                            const newData = [...prev];
                            if (newData[index]) { // Check index validity again
                                newData[index] = {
                                    ...newData[index],
                                    currentPrice: lastPrice,
                                    unrealizedPnl: unrealizedPnl,
                                    unrealizedPnlPercentage: unrealizedPnlPercentage,
                                    totalProfit: totalProfit,
                                    totalProfitPercentage: totalProfitPercentage,
                                    changeToday: changeToday, // Store change per share
                                    changeTodayPercentage: changeTodayPercentage,
                                    updating: false, // Mark as finished updating
                                };
                                // *** Add Logging ***
                                console.log(`[${holding.ticker}] Set updating = false (Success)`, newData[index]);
                            }
                            return newData;
                        });
                    })
                    .catch((err) => {
                        console.error(`Error fetching stock info for ${holding.ticker}:`, err);
                        // Mark as finished updating even on error
                        setHoldingsData((prev) => {
                            const newData = [...prev];
                            if (newData[index]) {
                                 newData[index] = { ...newData[index], updating: false };
                                 // *** Add Logging ***
                                 console.log(`[${holding.ticker}] Set updating = false (Error/Catch)`, newData[index]);
                            }
                            return newData;
                        });
                    });
            } else {
                 // For closed positions, ensure frontend calculated fields are null/default
                 // Note: Backend now provides realized P/L, so we mainly ensure market data is null.
                 setHoldingsData((prev) => {
                    const newData = [...prev];
                    if (newData[index]) {
                        // *** Add Logging for Closed Positions ***
                        console.log(`[${holding.ticker}] Closed Position Update:
  - Using realizedPnl from API: ${holding.realizedPnl}
  - Using realizedPnlPercentage from API: ${holding.realizedPnlPercentage}`);
                        // *** End Logging ***

                        newData[index] = {
                            ...newData[index],
                            currentPrice: null,
                            // unrealizedPnl: holding.realizedPnl, // For closed, unrealized is same as realized - SET TO NULL
                            unrealizedPnl: null,
                            // unrealizedPnlPercentage: holding.realizedPnlPercentage, // SET TO NULL
                            unrealizedPnlPercentage: null,
                            totalProfit: holding.realizedPnl, // For closed, total is same as realized
                            totalProfitPercentage: holding.realizedPnlPercentage, // Use realized percentage
                            changeToday: null,
                            changeTodayPercentage: null,
                            updating: false,
                        };
                    }
                    return newData;
                });
            }
        });
    // Dependencies: run when initial loading finishes or holdingsData array reference changes
    }, [loading, holdingsData]); // Removed priceUpdatesLaunched from dependencies

    // Apply sorting using our custom hook.
    const {items: sortedData, sortConfig, requestSort} = useSortableData(holdingsData);

    // Filter holdings based on netQuantity for status
    const filteredData = useMemo(() => {
        const searchTerms = search.toLowerCase().split(" ").filter((term) => term);
        return sortedData.filter((holding) => {
            const tradeSourceValue = `${holding.source?.name || ""} ${holding.owner?.name || ""}`.toLowerCase();
            const matchesSearch = searchTerms.every(
                (term) =>
                    holding.ticker.toLowerCase().includes(term) || tradeSourceValue.includes(term)
            );
            // Use netQuantity for status check
            const netQty = Number(holding.netQuantity);
            const isOpen = !isNaN(netQty) && netQty !== 0;
            const isClosed = !isNaN(netQty) && netQty === 0;

            const includeHolding =
                (selectedPositions.includes("open") && isOpen) ||
                (selectedPositions.includes("closed") && isClosed);

            return matchesSearch && includeHolding;
        });
    }, [sortedData, search, selectedPositions]);

    // Calculate totals based on FILTERED data (using frontend calculated/stored values)
    const filteredTotals = useMemo(
        () => {
            const totals = filteredData.reduce(
                (acc, holding) => {
                    acc.netCost += Number(holding.netCost) || 0;
                    // Sum unrealized P/L
                    const unrealizedPnl = holding.unrealizedPnl;
                    acc.profit += unrealizedPnl != null && !Number.isNaN(Number(unrealizedPnl)) ? Number(unrealizedPnl) : 0;
                    // Add Summation for Total Profit
                    const totalProfit = holding.totalProfit;
                    acc.totalProfit += totalProfit != null && !Number.isNaN(Number(totalProfit)) ? Number(totalProfit) : 0;
                    // Sum day change amount for open positions
                    const dayChangeAmount = holding.netQuantity !== 0 && holding.changeToday != null ? (holding.changeToday * holding.netQuantity) : 0;
                    acc.changeToday += dayChangeAmount != null && !Number.isNaN(Number(dayChangeAmount)) ? Number(dayChangeAmount) : 0;
                    // Use calculated market value
                    const marketValue = (holding.netQuantity != null && holding.currentPrice != null) ? (holding.netQuantity * holding.currentPrice) : (holding.netQuantity === 0 ? 0 : null);
                    acc.currentMarketValue += marketValue != null && !Number.isNaN(Number(marketValue)) ? Number(marketValue) : 0;
                    acc.tradeCount += Number(holding.tradeCount) || 0;
                    return acc;
                },
                { netCost: 0, profit: 0, totalProfit: 0, totalBuyCost: 0, currentMarketValue: 0, changeToday: 0, tradeCount: 0 }
            );

            // Calculate percentages based on the filtered totals
            totals.profitPercentage = totals.netCost !== 0
                ? (totals.profit / Math.abs(totals.netCost)) * 100
                : null;
            // Calculate Total Profit %
            totals.totalProfitPercentage = totals.totalBuyCost !== 0
                ? (totals.totalProfit / totals.totalBuyCost) * 100
                : (totals.totalProfit === 0 ? 0 : null); // Show 0% if profit is 0, else N/A if cost is 0

            totals.changeTodayPercentage = totals.netCost !== 0
                ? (totals.changeToday / totals.netCost) * 100
                : null;

            return totals;
        },
        [filteredData]
    );

    // Calculate OVERALL totals (unfiltered) for the top summary boxes
    const overallTotals = useMemo(
        () =>
            holdingsData.reduce( // Use holdingsData directly
                (acc, holding) => {
                    acc.netCost += Number(holding.netCost) || 0;
                    // Sum unrealized P/L
                    const unrealizedPnl = holding.unrealizedPnl;
                    acc.profit += unrealizedPnl != null && !Number.isNaN(Number(unrealizedPnl)) ? Number(unrealizedPnl) : 0;
                    // Add Summation for Total Profit
                    const totalProfit = holding.totalProfit;
                    acc.totalProfit += totalProfit != null && !Number.isNaN(Number(totalProfit)) ? Number(totalProfit) : 0;
                    // Sum day change amount for open positions
                    const dayChangeAmount = holding.netQuantity !== 0 && holding.changeToday != null ? (holding.changeToday * holding.netQuantity) : 0;
                    acc.changeToday += dayChangeAmount != null && !Number.isNaN(Number(dayChangeAmount)) ? Number(dayChangeAmount) : 0;
                    // Sum market value for open positions
                    if (holding.netQuantity !== 0) {
                         const marketValue = (holding.netQuantity != null && holding.currentPrice != null) ? (holding.netQuantity * holding.currentPrice) : null;
                         acc.currentMarketValue += marketValue != null && !Number.isNaN(Number(marketValue)) ? Number(marketValue) : 0;
                    }
                    return acc;
                },
                {netCost: 0, profit: 0, totalProfit: 0, changeToday: 0, currentMarketValue: 0}
            ),
        [holdingsData] // Depends on the raw holdings data + calculated values
    );

    // Top summary box calculations based on OVERALL totals
    const overallUnrealizedProfitPercentage =
        overallTotals.netCost !== 0 ? (overallTotals.profit / Math.abs(overallTotals.netCost)) * 100 : null;
    const overallUnrealizedProfit = overallTotals.profit;
    const overallChangeToday = overallTotals.changeToday;
    const overallChangeTodayPercentage =
        overallTotals.netCost !== 0 ? (overallChangeToday / overallTotals.netCost) * 100 : null;

    // Export the table to PDF.
    const exportToPDF = () => {
        const input = document.getElementById("exportableContent");
        if (!input) return;
        html2canvas(input, {scale: 2}).then((canvas) => {
            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF({
                orientation: "landscape",
                unit: "px",
                format: [canvas.width, canvas.height],
            });
            pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
            pdf.save("holdings_summary.pdf");
        });
    };

    return (
        <Box
            id="exportableContent"
            sx={{
                backgroundColor: colors.outerBackground,
                color: colors.text,
                minHeight: "100vh",
                p: 2,
            }}
        >
            <Container
                maxWidth="lg"
                sx={{
                    mt: 4,
                    backgroundColor: colors.background,
                    color: colors.text,
                }}
            >
                <Box sx={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                    <Typography variant="h4" gutterBottom>
                        Holdings Summary
                    </Typography>
                    {/* Hamburger icon to open settings drawer */}
                    <IconButton onClick={() => setDrawerOpen(true)} sx={{color: colors.text}}>
                        <MenuIcon/>
                    </IconButton>
                </Box>

                {/* Aggregated Metrics */}
                {aggLoading ? (
                    <CircularProgress/>
                ) : aggregateData ? (
                    <Box sx={{display: "flex", gap: 2, flexWrap: "wrap"}}>
                        <Paper
                            sx={{
                                p: 2,
                                mb: 2,
                                backgroundColor: colors.background,
                                color: colors.text,
                                flex: 1,
                                minWidth: 250,
                            }}
                        >
                            <Typography variant="h6">Investment Breakdown</Typography>
                            <Typography variant="body1">
                                Total Net Investment: ${formatNumber(aggregateData.overall?.totalNetCost || 0)}
                            </Typography>
                            {aggregateData.netCashBreakdown?.map((item, index) => (
                                <Typography key={index} variant="body1">
                                    {item.combination}: ${formatNumber(item.netCost)}
                                </Typography>
                            ))}
                        </Paper>
                        <Paper
                            sx={{
                                p: 2,
                                mb: 2,
                                backgroundColor: colors.background,
                                color: colors.text,
                                flex: 1,
                                minWidth: 250,
                            }}
                        >
                            <Typography variant="h6">Overall Performance</Typography>
                            <Typography variant="body1">
                                Unrealized P/L %:{" "}
                                <span style={{color: overallUnrealizedProfitPercentage >= 0 ? colors.positive : colors.negative}}>
                                    {formatNumber(overallUnrealizedProfitPercentage)}%
                                </span>
                            </Typography>
                            <Typography variant="body1">
                                Unrealized P/L:{" "}
                                <span style={{color: overallUnrealizedProfit >= 0 ? colors.positive : colors.negative}}>
                                     ${formatNumber(overallUnrealizedProfit)}
                                </span>
                            </Typography>
                            <Typography variant="body1">
                                Total Profit:{" "}
                                <span style={{color: overallTotals.totalProfit >= 0 ? colors.positive : colors.negative}}>
                                     {/* Check if totalProfit is valid before formatting */}
                                     {overallTotals.totalProfit != null ? formatNumber(overallTotals.totalProfit) : "N/A"}
                                </span>
                            </Typography>
                            <Typography variant="body1">
                                Day Change:{" "}
                                <span style={{color: overallChangeToday >= 0 ? colors.positive : colors.negative}}>
                                    ${formatNumber(overallChangeToday)}
                                </span>
                            </Typography>
                            <Typography variant="body1">
                                Day Change %:{" "}
                                <span style={{color: overallChangeTodayPercentage >= 0 ? colors.positive : colors.negative}}>
                                    {formatNumber(overallChangeTodayPercentage)}%
                                </span>
                            </Typography>
                        </Paper>
                    </Box>
                ) : null}

                {/* Search, Position Filter, and Columns Filter Icon Row */}
                <Box sx={{display: "flex", alignItems: "center", mb: 2}}>
                    <TextField
                        label="Search by Ticker, Source, or Owner"
                        variant="outlined"
                        fullWidth
                        sx={{
                            input: {color: colors.text},
                            label: {color: colors.text},
                        }}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    {/* Multi-select for position status */}
                    <FormControl sx={{minWidth: 200, ml: 2}}>
                        <InputLabel id="position-filter-label" sx={{color: colors.text}}>
                            Position Status
                        </InputLabel>
                        <Select
                            labelId="position-filter-label"
                            multiple
                            value={selectedPositions}
                            onChange={(e) => setSelectedPositions(e.target.value)}
                            renderValue={(selected) => selected.join(", ")}
                            sx={{
                                color: colors.text,
                                "& .MuiOutlinedInput-notchedOutline": {
                                    borderColor: colors.border,
                                },
                            }}
                            MenuProps={{
                                PaperProps: {
                                    sx: {
                                        backgroundColor: colors.background,
                                        color: colors.text,
                                    },
                                },
                            }}
                        >
                            {["open", "closed"].map((status) => (
                                <MenuItem key={status} value={status}>
                                    <Checkbox checked={selectedPositions.indexOf(status) > -1}
                                              sx={{color: colors.text}}/>
                                    <ListItemText primary={status.charAt(0).toUpperCase() + status.slice(1)}/>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    {/* Columns Filter Icon (3-dots) */}
                    <IconButton onClick={handleColumnsMenuOpen} sx={{ml: 2, color: colors.text}}>
                        <MoreVertIcon/>
                    </IconButton>
                    <Menu
                        anchorEl={columnsMenuAnchor}
                        open={Boolean(columnsMenuAnchor)}
                        onClose={handleColumnsMenuClose}
                    >
                        <Typography variant="subtitle1" sx={{m: 2, color: colors.text}}>
                            Columns
                        </Typography>
                        {columns.map((col) => (
                            <MenuItem
                                key={col.key}
                                onClick={() => {
                                    // Toggle column visibility if not always visible.
                                    if (!col.alwaysVisible) {
                                        setVisibleColumns((prev) => ({
                                            ...prev,
                                            [col.key]: !prev[col.key],
                                        }));
                                    }
                                }}
                            >
                                <Checkbox
                                    checked={visibleColumns[col.key]}
                                    disabled={col.alwaysVisible}
                                    sx={{color: colors.text}}
                                />
                                <ListItemText primary={col.label}/>
                            </MenuItem>
                        ))}
                    </Menu>

                </Box>

                {/* Holdings Table */}
                {loading ? (
                    <CircularProgress/>
                ) : (
                    <TableContainer
                        component={Paper}
                        sx={{
                            backgroundColor: colors.background,
                            color: colors.text,
                        }}
                    >
                        <Table>
                            <TableHead>
                                <TableRow>
                                    {columns
                                        .filter((col) => visibleColumns[col.key])
                                        .map((col) => (
                                            <TableCell key={col.key} sx={{color: colors.text}}>
                                                {col.sortable ? (
                                                    <TableSortLabel
                                                        active={sortConfig.key === col.key}
                                                        direction={sortConfig.key === col.key ? sortConfig.direction : "asc"}
                                                        // Pass the key and the sortValue function (if defined) to requestSort
                                                        onClick={() => requestSort(col.key, col.sortValue)}
                                                    >
                                                        {col.label}
                                                    </TableSortLabel>
                                                ) : (
                                                    col.label // Render label directly if not sortable
                                                )}
                                            </TableCell>
                                        ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredData.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        sx={
                                            highlightSignificant && Math.abs(row.changeTodayPercentage || 0) >= 5
                                                ? {backgroundColor: colors.highlight, "& td": {color: colors.text}}
                                                : {"& td": {color: colors.text}}
                                        }
                                    >
                                        {columns
                                            .filter((col) => visibleColumns[col.key])
                                            .map((col) => (
                                                <TableCell key={col.key} sx={{color: colors.text}}>
                                                    {col.format ? col.format(row) : row[col.key]}
                                                </TableCell>
                                            ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter>
                                <TableRow sx={{borderTop: `3px solid ${colors.border}`}}>
                                    {columns.filter((col) => visibleColumns[col.key]).map((col, index) => {
                                        let cellContent = "";
                                        // Use filteredTotals for footer display
                                        if (col.key === "netCost") {
                                            cellContent = `$${formatNumber(filteredTotals.netCost)}`;
                                        } else if (col.key === "currentMarketValue") {
                                            cellContent = `$${formatNumber(filteredTotals.currentMarketValue)}`;
                                        } else if (col.key === "profit") {
                                            cellContent = (
                                                <span style={{color: filteredTotals.profit >= 0 ? colors.positive : colors.negative}}>
                                                    ${formatNumber(filteredTotals.profit)}
                                                </span>
                                            );
                                        } else if (col.key === "unrealizedPnlPercentage") {
                                            cellContent = filteredTotals.profitPercentage != null ? (
                                                <span style={{color: filteredTotals.profitPercentage >= 0 ? colors.positive : colors.negative}}>
                                                    {formatNumber(filteredTotals.profitPercentage)}%
                                                </span>
                                            ) : "N/A";
                                        } else if (col.key === "totalProfit") {
                                            cellContent = (
                                                <span style={{color: filteredTotals.totalProfit >= 0 ? colors.positive : colors.negative}}>
                                                   ${formatNumber(filteredTotals.totalProfit)}
                                               </span>
                                            );
                                        } else if (col.key === "totalProfitPercentage") {
                                            cellContent = filteredTotals.totalProfitPercentage != null ? (
                                               <span style={{color: filteredTotals.totalProfitPercentage >= 0 ? colors.positive : colors.negative}}>
                                                   {formatNumber(filteredTotals.totalProfitPercentage)}%
                                               </span>
                                           ) : "N/A";
                                        } else if (col.key === "changeToday") {
                                            cellContent = (
                                                 <span style={{color: filteredTotals.changeToday >= 0 ? colors.positive : colors.negative}}>
                                                    ${formatNumber(filteredTotals.changeToday)}
                                                </span>
                                            );
                                        } else if (col.key === "changeTodayPercentage") {
                                            cellContent = filteredTotals.changeTodayPercentage != null ? (
                                                <span style={{color: filteredTotals.changeTodayPercentage >= 0 ? colors.positive : colors.negative}}>
                                                    {formatNumber(filteredTotals.changeTodayPercentage)}%
                                                </span>
                                            ) : "N/A";
                                        } else if (col.key === "tradeCount") {
                                            cellContent = formatNumber(filteredTotals.tradeCount, 0);
                                        } else if (index === 0) { // First visible column
                                            cellContent = "Total:";
                                        }
                                        return (
                                            <TableCell key={col.key} sx={{color: colors.text, fontWeight: "bold"}}>
                                                {cellContent}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </TableContainer>
                )}
            </Container>

            {/* Settings Drawer */}
            <Drawer
                anchor="right"
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                PaperProps={{
                    sx: {
                        backgroundColor: colors.background, // uses dark mode color when enabled
                        color: colors.text,
                        height: "100vh", // ensures the entire drawer is styled
                    },
                }}
            >
                <Box sx={{width: 250, p: 2}}>
                    <Typography variant="h6" gutterBottom>
                        Settings
                    </Typography>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                                sx={{color: colors.text}}
                            />
                        }
                        label="Auto Refresh"
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={darkMode}
                                onChange={(e) => setDarkMode(e.target.checked)}
                                sx={{color: colors.text}}
                            />
                        }
                        label="Dark Mode"
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={highlightSignificant}
                                onChange={(e) => setHighlightSignificant(e.target.checked)}
                                sx={{color: colors.text}}
                            />
                        }
                        label="Highlight Significant Changes"
                    />
                    <Button variant="contained" onClick={exportToPDF} sx={{mt: 2}}>
                        Export to PDF
                    </Button>
                </Box>
            </Drawer>

        </Box>
    );
}

export default SummaryPage;
