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
} from "@mui/material";
import {jsPDF} from "jspdf";
import html2canvas from "html2canvas";

// Utility function for formatting numbers
const formatNumber = (num, decimals = 2, locale = "en-US") =>
    Number(num).toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });

// Define a central columns' configuration. Notice you can add formatting and styling.
const columns = [
    {
        key: "ticker",
        label: "Ticker",
        alwaysVisible: true,
        defaultVisible: true,
    },
    {
        key: "tradeSource",
        label: "Trade Source",
        defaultVisible: true,
        format: (row) => `${row.source}${row.tradeType ? ` (${row.tradeType})` : ""}`,
    },
    {
        key: "netQuantity",
        label: "Net Quantity",
        defaultVisible: false,
    },
    {
        key: "netCost",
        label: "Net Cost",
        defaultVisible: true,
        format: (row) => `$${formatNumber(row.netCost)}`,
    },
    {
        key: "latestTradePrice",
        label: "Latest Trade Price",
        defaultVisible: true,
        format: (row) => (row.latestTradePrice ? `$${formatNumber(row.latestTradePrice)}` : "N/A"),
    },
    {
        key: "currentPrice",
        label: "Current Price",
        defaultVisible: true,
        format: (row) =>
            row.updating ?
                <CircularProgress size={16}/> : row.currentPrice != null ? `$${formatNumber(row.currentPrice)}` :
                    <span style={{color: "lightgray"}}>N/A</span>,
    },
    {
        key: "profit",
        label: "Profit",
        defaultVisible: true,
        format: (row) =>
            row.updating ? (
                <CircularProgress size={16}/>
            ) : row.profit != null ? (
                <span style={{color: row.profit >= 0 ? "green" : "red"}}>${formatNumber(row.profit)}</span>
            ) : (
                <span style={{color: "lightgray"}}>N/A</span>
            ),
    },
    {
        key: "profitPercentage",
        label: "Profit (%)",
        defaultVisible: true,
        format: (row) =>
            row.updating ? (
                <CircularProgress size={16}/>
            ) : row.profitPercentage != null ? (
                <span style={{color: row.profitPercentage >= 0 ? "green" : "red"}}>
          {formatNumber(row.profitPercentage)}%
        </span>
            ) : (
                <span style={{color: "lightgray"}}>N/A</span>
            ),
        footer: () => "", // Customize footer cell if needed
    },
    {
        key: "changeToday",
        label: "Change Today",
        defaultVisible: true,
        format: (row) =>
            row.changeToday != null ? (
                <span style={{color: row.changeToday >= 0 ? "green" : "red"}}>${formatNumber(row.changeToday)}</span>
            ) : (
                <span style={{color: "lightgray"}}>N/A</span>
            ),
    },
    {
        key: "changeTodayPercentage",
        label: "Change Today (%)",
        defaultVisible: true,
        format: (row) =>
            row.changeTodayPercentage != null ? (
                <span style={{color: row.changeTodayPercentage >= 0 ? "green" : "red"}}>
          {formatNumber(row.changeTodayPercentage)}%
        </span>
            ) : (
                <span style={{color: "lightgray"}}>N/A</span>
            ),
    },
    {
        key: "holdingPeriod",
        label: "Holding Period (days)",
        defaultVisible: false,
    },
    {
        key: "tradeCount",
        label: "Trade Count",
        defaultVisible: false,
        format: (row) => (row.tradeCount !== undefined ? Number(row.tradeCount).toLocaleString() : "N/A"),
    },
];

// Custom hook to handle sorting logic
const useSortableData = (items, initialConfig = {key: "netQuantity", direction: "desc"}) => {
    const [sortConfig, setSortConfig] = useState(initialConfig);

    const sortedItems = useMemo(() => {
        const sortable = [...items];
        if (sortConfig !== null) {
            sortable.sort((a, b) => {
                const aValue = a[sortConfig.key] ?? "";
                const bValue = b[sortConfig.key] ?? "";
                if (typeof aValue === "number" && typeof bValue === "number") {
                    return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
                }
                return sortConfig.direction === "asc"
                    ? String(aValue).localeCompare(String(bValue))
                    : String(bValue).localeCompare(String(aValue));
            });
        }
        return sortable;
    }, [items, sortConfig]);

    const requestSort = useCallback(
        (key) => {
            let direction = "asc";
            if (sortConfig.key === key && sortConfig.direction === "asc") {
                direction = "desc";
            }
            setSortConfig({key, direction});
        },
        [sortConfig]
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
    const [includeClosed, setIncludeClosed] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [darkMode, setDarkMode] = useState(false);
    const [highlightSignificant, setHighlightSignificant] = useState(true);

    // Control which columns are visible. New columns only need to be added to the columns array.
    const [visibleColumns, setVisibleColumns] = useState(
        columns.reduce((acc, col) => {
            acc[col.key] = col.defaultVisible;
            return acc;
        }, {})
    );
    // Fetch holdings data on mount and aggregate metrics
    useEffect(() => {
        fetch(`${process.env.REACT_APP_API_URL}/holdings`)
            .then((res) => res.json())
            .then((data) => {
                setHoldingsData(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Error fetching holdings:", err);
                setLoading(false);
            });

        fetch(`${process.env.REACT_APP_API_URL}/holdings-summary`)
            .then((res) => res.json())
            .then((data) => {
                setAggregateData(data);
                setAggLoading(false);
            })
            .catch((err) => {
                console.error("Error fetching holdings summary:", err);
                setAggLoading(false);
            });
    }, []);

    // Auto-refresh if enabled
    useEffect(() => {
        if (autoRefresh) {
            const interval = setInterval(() => {
                fetch(`${process.env.REACT_APP_API_URL}/holdings`)
                    .then((res) => res.json())
                    .then(setHoldingsData)
                    .catch((err) => console.error("Error fetching holdings:", err));
            }, 60000);
            return () => clearInterval(interval);
        }
    }, [autoRefresh]);

    // Update current prices for open holdings
    useEffect(() => {
        if (!loading && holdingsData.length && !priceUpdatesLaunched) {
            setPriceUpdatesLaunched(true);
            holdingsData.forEach((holding, index) => {
                if (holding.netQuantity !== 0) {
                    setHoldingsData((prev) => {
                        const newData = [...prev];
                        newData[index] = {...newData[index], updating: true};
                        return newData;
                    });
                    fetch(`${process.env.REACT_APP_API_URL}/stock-info/${holding.ticker}`)
                        .then((res) => res.json())
                        .then((data) => {
                            const {lastPrice, changeToday, changeTodayPercentage} = data;
                            const avgCost = holding.averageCost;
                            const updatedProfit = (lastPrice - avgCost) * holding.netQuantity;
                            const updatedProfitPercentage = ((lastPrice - avgCost) / avgCost) * 100;

                            setHoldingsData((prev) => {
                                const newData = [...prev];
                                newData[index] = {
                                    ...newData[index],
                                    currentPrice: lastPrice,
                                    profit: updatedProfit,
                                    profitPercentage: updatedProfitPercentage,
                                    changeToday,
                                    changeTodayPercentage,
                                    updating: false,
                                };
                                return newData;
                            });
                        })
                        .catch((err) => {
                            console.error(`Error fetching last price for ${holding.ticker}:`, err);
                            setHoldingsData((prev) => {
                                const newData = [...prev];
                                newData[index] = {...newData[index], updating: false};
                                return newData;
                            });
                        });
                } else {
                    // For closed positions, set profit values directly
                    setHoldingsData((prev) => {
                        const newData = [...prev];
                        newData[index] = {
                            ...newData[index],
                            currentPrice: null,
                            profit: holding.profit || 0,
                            profitPercentage: holding.profitPercentage || 0,
                            updating: false,
                        };
                        return newData;
                    });
                }
            });
        }
    }, [loading, holdingsData, priceUpdatesLaunched]);

    // Apply sorting using our custom hook
    const {items: sortedData, sortConfig, requestSort} = useSortableData(holdingsData);

    // Filter holdings based on search input and closed status
    const filteredData = useMemo(() => {
        const searchTerms = search.toLowerCase().split(" ").filter((term) => term);
        return sortedData.filter((holding) => {
            const tradeSourceValue = `${holding.source} ${holding.tradeType || ""}`.toLowerCase();
            const matchesSearch = searchTerms.every(
                (term) =>
                    holding.ticker.toLowerCase().includes(term) || tradeSourceValue.includes(term)
            );
            const includeHolding = includeClosed ? true : holding.netQuantity !== 0;
            return matchesSearch && includeHolding;
        });
    }, [sortedData, search, includeClosed]);

    // Calculate totals (example for a few columns)
    const totals = useMemo(
        () =>
            filteredData.reduce(
                (acc, holding) => {
                    acc.netQuantity += Number(holding.netQuantity) || 0;
                    acc.netCost += Number(holding.netCost) || 0;
                    acc.profit += holding.profit != null ? Number(holding.profit) : 0;
                    acc.tradeCount += Number(holding.tradeCount) || 0;
                    return acc;
                },
                {netQuantity: 0, netCost: 0, profit: 0, tradeCount: 0}
            ),
        [filteredData]
    );

    // Export the table to PDF
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
                backgroundColor: darkMode ? "#222" : "inherit",
                color: darkMode ? "white" : "inherit",
                minHeight: "100vh",
                p: 2,
            }}
        >
            <Container
                maxWidth="lg"
                sx={{
                    mt: 4,
                    backgroundColor: darkMode ? "#333" : "inherit",
                    color: darkMode ? "white" : "inherit",
                }}
            >
                <Typography variant="h4" gutterBottom>
                    Holdings Summary
                </Typography>

                {/* Aggregated Metrics */}
                {aggLoading ? (
                    <CircularProgress/>
                ) : aggregateData ? (
                    <Paper
                        sx={{
                            p: 2,
                            mb: 2,
                            backgroundColor: darkMode ? "#333" : "white",
                            color: darkMode ? "white" : "inherit",
                        }}
                    >
                        <Typography variant="h6">Overall Metrics</Typography>
                        <Typography variant="body1">
                            Total Net Cash: ${formatNumber(aggregateData.overall?.totalNetCost || 0)}
                        </Typography>
                        <Typography variant="body1">
                            Total Profit Percentage:{" "}
                            {aggregateData.overall?.totalProfitPercentage != null
                                ? `${formatNumber(aggregateData.overall.totalProfitPercentage)}%`
                                : "N/A"}
                        </Typography>
                        <Typography variant="body1">
                            Change Today: ${formatNumber(aggregateData.overall?.changeToday || 0)}
                        </Typography>
                        <Typography variant="body1">
                            Change Today Percentage:{" "}
                            {aggregateData.overall?.changeTodayPercentage != null
                                ? `${formatNumber(aggregateData.overall.changeTodayPercentage)}%`
                                : "N/A"}
                        </Typography>
                    </Paper>
                ) : null}

                {/* Settings Bar */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        mb: 2,
                        border: "1px solid lightgray",
                        p: 1,
                    }}
                >
                    <FormControl sx={{minWidth: 200, mr: 2}}>
                        <InputLabel id="columns-select-label" sx={{color: darkMode ? "white" : "inherit"}}>
                            Columns
                        </InputLabel>
                        <Select
                            multiple
                            value={Object.keys(visibleColumns).filter((key) => visibleColumns[key])}
                            onChange={(e) => {
                                const selected = e.target.value;
                                const newVisible = {};
                                columns.forEach((col) => {
                                    newVisible[col.key] = col.alwaysVisible || selected.includes(col.key);
                                });
                                setVisibleColumns(newVisible);
                            }}
                            renderValue={(selected) =>
                                selected.length > 3
                                    ? `${selected.slice(0, 3)
                                        .map((key) => columns.find((col) => col.key === key)?.label)
                                        .join(", ")}...`
                                    : selected.map((key) => columns.find((col) => col.key === key)?.label).join(", ")
                            }
                        >
                            {columns.map((col) => (
                                <MenuItem key={col.key} value={col.key}>
                                    <Checkbox checked={visibleColumns[col.key]} disabled={col.alwaysVisible}/>
                                    <ListItemText primary={col.label}/>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControlLabel
                        control={
                            <Checkbox
                                sx={{mr: 2, color: darkMode ? "white" : "inherit"}}
                                checked={includeClosed}
                                onChange={(e) => setIncludeClosed(e.target.checked)}
                            />
                        }
                        label="Include Closed Positions"
                        sx={{mr: 2}}
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                sx={{mr: 2, color: darkMode ? "white" : "inherit"}}
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                            />
                        }
                        label="Auto Refresh"
                        sx={{mr: 2}}
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                sx={{mr: 2, color: darkMode ? "white" : "inherit"}}
                                checked={darkMode}
                                onChange={(e) => setDarkMode(e.target.checked)}
                            />
                        }
                        label="Dark Mode"
                        sx={{mr: 2}}
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                sx={{mr: 2, color: darkMode ? "white" : "inherit"}}
                                checked={highlightSignificant}
                                onChange={(e) => setHighlightSignificant(e.target.checked)}
                            />
                        }
                        label="Highlight Significant Changes"
                    />
                    <Button variant="contained" sx={{ml: 2}} onClick={exportToPDF}>
                        Export to PDF
                    </Button>
                </Box>

                {/* Search Filter */}
                <TextField
                    label="Search by Ticker, Source, or Type"
                    variant="outlined"
                    fullWidth
                    sx={{
                        mb: 2,
                        input: {color: darkMode ? "white" : "inherit"},
                        label: {color: darkMode ? "white" : "inherit"},
                    }}
                    onChange={(e) => setSearch(e.target.value)}
                />

                {/* Holdings Table */}
                {loading ? (
                    <CircularProgress/>
                ) : (
                    <TableContainer
                        component={Paper}
                        sx={{
                            backgroundColor: darkMode ? "#333" : "inherit",
                            color: darkMode ? "white" : "inherit",
                        }}
                    >
                        <Table>
                            <TableHead>
                                <TableRow>
                                    {columns
                                        .filter((col) => visibleColumns[col.key])
                                        .map((col) => (
                                            <TableCell key={col.key}>
                                                <TableSortLabel
                                                    active={sortConfig.key === col.key}
                                                    direction={sortConfig.key === col.key ? sortConfig.direction : "asc"}
                                                    onClick={() => requestSort(col.key)}
                                                >
                                                    {col.label}
                                                </TableSortLabel>
                                            </TableCell>
                                        ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredData.map((row) => (
                                    <TableRow key={row.id}>
                                        {columns
                                            .filter((col) => visibleColumns[col.key])
                                            .map((col) => (
                                                <TableCell key={col.key}>
                                                    {col.format ? col.format(row) : row[col.key]}
                                                </TableCell>
                                            ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter>
                                <TableRow sx={{borderTop: "3px solid", borderColor: "divider"}}>
                                    {columns.map((col) => (
                                        <TableCell key={col.key}>
                                            {/* For totals, you can customize based on the column key */}
                                            {col.key === "netQuantity"
                                                ? totals.netQuantity === 0
                                                    ? "Closed"
                                                    : Number(totals.netQuantity).toLocaleString()
                                                : col.key === "netCost"
                                                    ? `$${formatNumber(totals.netCost)}`
                                                    : col.key === "profit"
                                                        ? (
                                                            <span style={{color: totals.profit >= 0 ? "green" : "red"}}>
                            ${formatNumber(totals.profit)}
                          </span>
                                                        )
                                                        : col.key === "tradeCount"
                                                            ? Number(totals.tradeCount).toLocaleString()
                                                            : ""}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </TableContainer>
                )}
            </Container>
        </Box>
    );
}

export default SummaryPage;
