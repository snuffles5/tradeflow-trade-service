import React, {useEffect, useState} from "react";
import {jsPDF} from "jspdf";
import html2canvas from "html2canvas";
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
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Checkbox,
    ListItemText,
    FormControlLabel,
    Button,
} from "@mui/material";

// Helper function to format numbers with commas and fixed decimals
const formatNumber = (num, decimals = 2) => {
    return Number(num).toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
};

function SummaryPage() {
    const [summaryData, setSummaryData] = useState([]);
    const [aggregateData, setAggregateData] = useState(null);
    const [sortConfig, setSortConfig] = useState({key: "totalQuantity", direction: "desc"});
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [aggLoading, setAggLoading] = useState(true);
    const [lastPriceUpdatesLaunched, setLastPriceUpdatesLaunched] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState({
        ticker: true,
        source: true,
        tradeType: true,
        totalQuantity: false,
        totalCost: false,
        lastPrice: true,
        currentPrice: true,
        profit: true,
        profitPercentage: true,
        changeToday: true,
        changeTodayPercentage: true,
        holdingPeriod: false,
        tradeCount: false,
    });
    const [includeClosedPositions, setIncludeClosedPositions] = useState(false);
    // Extra settings options
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [darkMode, setDarkMode] = useState(false);
    const [highlightSignificant, setHighlightSignificant] = useState(true);

    useEffect(() => {
        if (autoRefresh) {
            const interval = setInterval(() => {
                fetch(`${process.env.REACT_APP_API_URL}/aggregated-trades`)
                    .then((res) => res.json())
                    .then((data) => {
                        setSummaryData(data);
                    })
                    .catch((err) => {
                        console.error("Error fetching trade summary:", err);
                    });
            }, 60000); // Refresh every 60 seconds
            return () => clearInterval(interval);
        }
    }, [autoRefresh]);

    useEffect(() => {
        // Fetch detailed trade summary data
        fetch(`${process.env.REACT_APP_API_URL}/aggregated-trades`)
            .then((res) => res.json())
            .then((data) => {
                setSummaryData(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Error fetching trade summary:", err);
                setLoading(false);
            });

        // Fetch aggregated data for overall metrics and breakdowns
        fetch(`${process.env.REACT_APP_API_URL}/trade-summary`)
            .then((res) => res.json())
            .then((data) => {
                setAggregateData(data);
                setAggLoading(false);
            })
            .catch((err) => {
                console.error("Error fetching aggregated summary:", err);
                setAggLoading(false);
            });
    }, []);

    useEffect(() => {
        if (!loading && summaryData.length > 0 && !lastPriceUpdatesLaunched) {
            setLastPriceUpdatesLaunched(true);

            // Iterate through each row to update if it is an open position.
            summaryData.forEach((trade, index) => {
                // Only update for open positions (totalQuantity !== 0)
                if (trade.totalQuantity !== 0) {
                    // Set the row to "updating" state so UI shows the spinner
                    setSummaryData((prev) => {
                        const newData = [...prev];
                        newData[index] = {...newData[index], updating: true};
                        return newData;
                    });

                    fetch(`${process.env.REACT_APP_API_URL}/stock-info/${trade.ticker}`)
                        .then((res) => res.json())
                        .then((data) => {
                            // Compute updated profit and profitPercentage using the fresh lastPrice
                            const lastPrice = data.lastPrice;
                            const changeToday = data.changeToday;
                            const changeTodayPercentage = data.changeTodayPercentage;
                            const avgCost = trade.totalCost / trade.totalQuantity;
                            let updatedProfit, updatedProfitPercentage;
                            if (trade.totalQuantity > 0) {
                                updatedProfit = (lastPrice - avgCost) * trade.totalQuantity;
                                updatedProfitPercentage = ((lastPrice / avgCost) - 1) * 100;
                            } else { // For short positions
                                updatedProfit = (avgCost - lastPrice) * Math.abs(trade.totalQuantity);
                                updatedProfitPercentage = ((avgCost / lastPrice) - 1) * 100;
                            }
                            // Update the specific row with new values and mark updating as false.
                            setSummaryData((prev) => {
                                const newData = [...prev];
                                newData[index] = {
                                    ...newData[index],
                                    currentPrice: lastPrice, // update currentPrice as well
                                    profit: updatedProfit,
                                    profitPercentage: updatedProfitPercentage,
                                    changeToday: changeToday,
                                    changeTodayPercentage: changeTodayPercentage,
                                    updating: false,
                                };
                                return newData;
                            });
                        })
                        .catch((err) => {
                            console.error(`Error fetching last price for ${trade.ticker}:`, err);
                            // On error, simply mark updating as false so N/A is shown.
                            setSummaryData((prev) => {
                                const newData = [...prev];
                                newData[index] = {...newData[index], updating: false};
                                return newData;
                            });
                        });
                }
            });
        }
    }, [loading, summaryData, lastPriceUpdatesLaunched]);

    // Sort the data based on sortConfig
    const sortedData = [...summaryData].sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        // If both values are numbers, do numeric comparison.
        if (typeof aValue === "number" && typeof bValue === "number") {
            return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
        }

        // Otherwise, treat as text (even if one of them is undefined or null).
        const aStr = aValue ? aValue.toString() : "";
        const bStr = bValue ? bValue.toString() : "";
        return sortConfig.direction === "asc"
            ? aStr.localeCompare(bStr)
            : bStr.localeCompare(aStr);
    });

    // Filter data based on search terms
    const filteredData = sortedData.filter((trade) => {
        const searchTerms = search.toLowerCase().split(" ").filter((term) => term);
        const matchesSearch = searchTerms.every(
            (term) =>
                trade.ticker.toLowerCase().includes(term) ||
                trade.source.toLowerCase().includes(term) ||
                trade.tradeType.toLowerCase().includes(term)
        );
        const includeTrade = includeClosedPositions ? true : trade.totalQuantity !== 0;
        return matchesSearch && includeTrade;
    });

    // Pre-calculate totals from filtered data
    const totals = filteredData.reduce(
        (acc, trade) => {
            acc.totalQuantity += Number(trade.totalQuantity) || 0;
            acc.totalCost += Number(trade.totalCost) || 0;
            acc.profit += trade.profit !== null ? Number(trade.profit) : 0;
            acc.tradeCount += Number(trade.tradeCount) || (trade.trades ? trade.trades.length : 0);
            acc.changeToday += trade.changeToday !== null && trade.changeToday !== undefined ? Number(trade.changeToday) : 0;
            acc.changeTodayPercentage +=
                trade.changeTodayPercentage !== null && trade.changeTodayPercentage !== undefined
                    ? Number(trade.changeTodayPercentage)
                    : 0;
            return acc;
        },
        {totalQuantity: 0, totalCost: 0, profit: 0, tradeCount: 0, changeToday: 0, changeTodayPercentage: 0}
    );

    const handleSort = (key) => {
        setSortConfig((prev) => ({
            key,
            direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
        }));
    };

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
            pdf.save("trades_summary.pdf");
        });
    };

    const columns = [
        {key: "ticker", label: "Ticker"},
        {key: "source", label: "Source"},
        {key: "tradeType", label: "Type"},
        {key: "totalQuantity", label: "Total Quantity"},
        {key: "totalCost", label: "Net Cost"},
        {key: "lastPrice", label: "Last Trade Price"},
        {key: "currentPrice", label: "Current Price"},
        {key: "profit", label: "Profit"},
        {key: "profitPercentage", label: "Profit (%)"},
        {key: "changeToday", label: "Change Today"},
        {key: "changeTodayPercentage", label: "Change Today (%)"},
        {key: "holdingPeriod", label: "Holding Period (days)"},
        {key: "tradeCount", label: "Trade Count"},
    ];

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
                    Trades Summary
                </Typography>

                {/* Aggregated Metrics Section */}
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
                            Total Net Cash: ${formatNumber(aggregateData.overall.totalNetCash)}
                        </Typography>
                        <Typography variant="body1">
                            Total Profit Percentage:{" "}
                            {aggregateData.overall.totalProfitPercentage !== null
                                ? `${formatNumber(aggregateData.overall.totalProfitPercentage)}%`
                                : "N/A"}
                        </Typography>
                        <Box sx={{mt: 2}}>
                            <Grid container spacing={2}>
                                {/* Breakdown by Source */}
                                <Grid item xs={6}>
                                    <Typography variant="subtitle1">By Source</Typography>
                                    {Object.entries(aggregateData.bySource).map(([source, data]) => (
                                        <Box key={source} sx={{mb: 1}}>
                                            <Typography variant="body2">
                                                <strong>{source}:</strong> Net Cash:
                                                ${formatNumber(data.totalNetCash)} | Profit %:{" "}
                                                {data.profitPercentage !== null ? `${formatNumber(data.profitPercentage)}%` : "N/A"}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Grid>
                                {/* Breakdown by Type */}
                                <Grid item xs={6}>
                                    <Typography variant="subtitle1">By Type</Typography>
                                    {Object.entries(aggregateData.byType).map(([tradeType, data]) => (
                                        <Box key={tradeType} sx={{mb: 1}}>
                                            <Typography variant="body2">
                                                <strong>{tradeType}:</strong> Net Cash: ${formatNumber(data.totalNetCash)} |
                                                Profit %:{" "}
                                                {data.profitPercentage !== null ? `${formatNumber(data.profitPercentage)}%` : "N/A"}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Grid>
                            </Grid>
                        </Box>
                    </Paper>
                ) : null}

                {/* Settings Bar */}
                <Box sx={{display: "flex", alignItems: "center", mb: 2, border: "1px solid lightgray", p: 1}}>
                    <FormControl sx={{minWidth: 200, mr: 2}}>
                        <InputLabel
                            id="columns-select-label"
                            sx={{color: darkMode ? "white" : "inherit"}}
                        >
                            Columns
                        </InputLabel>
                        <Select
                            labelId="columns-select-label"
                            multiple
                            value={Object.keys(visibleColumns).filter((key) => visibleColumns[key])}
                            onChange={(e) => {
                                const selected = e.target.value;
                                const newVisible = {};
                                columns.forEach((col) => {
                                    newVisible[col.key] = col.key === "ticker" ? true : selected.includes(col.key);
                                });
                                setVisibleColumns(newVisible);
                            }}
                            label="Columns"
                            sx={{
                                color: darkMode ? "white" : "inherit",
                                backgroundColor: darkMode ? "#333" : "inherit",
                            }}
                            MenuProps={{
                                PaperProps: {
                                    sx: {
                                        backgroundColor: darkMode ? "#333" : "inherit",
                                        color: darkMode ? "white" : "inherit",
                                    },
                                },
                            }}
                            renderValue={(selected) =>
                                selected.length > 3
                                    ? `${selected
                                        .slice(0, 3)
                                        .map((key) => {
                                            const col = columns.find((c) => c.key === key);
                                            return col ? col.label : key;
                                        })
                                        .join(", ")}...`
                                    : selected
                                        .map((key) => {
                                            const col = columns.find((c) => c.key === key);
                                            return col ? col.label : key;
                                        })
                                        .join(", ")
                            }
                        >
                            {columns.map((col) => (
                                <MenuItem
                                    key={col.key}
                                    value={col.key}
                                    sx={{
                                        backgroundColor: darkMode ? "#333" : "inherit",
                                        color: darkMode ? "white" : "inherit",
                                    }}
                                >
                                    <Checkbox
                                        sx={{
                                            color: darkMode ? "white" : "inherit",
                                            "&.Mui-checked": {color: darkMode ? "white" : "inherit"},
                                        }}
                                        checked={visibleColumns[col.key]}
                                        disabled={col.key === "ticker"}
                                    />
                                    <ListItemText primary={col.label} sx={{color: darkMode ? "white" : "inherit"}}/>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControlLabel
                        control={
                            <Checkbox
                                sx={{mr: 2, color: darkMode ? "white" : "inherit"}}
                                checked={includeClosedPositions}
                                onChange={(e) => setIncludeClosedPositions(e.target.checked)}
                            />
                        }
                        label="Include Closed Positions"
                        sx={{mr: 2}}
                    />
                    {/* Extra Options */}
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

                {/* Detailed Summary Table */}
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
                        <Box
                            sx={{
                                "& .MuiTableCell-root": {
                                    color: darkMode ? "white" : "inherit",
                                    backgroundColor: darkMode ? "#333" : "inherit",
                                },
                                "& .MuiTableRow-root": {
                                    backgroundColor: darkMode ? "#333" : "inherit",
                                },
                            }}
                        >
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        {visibleColumns.ticker && (
                                            <TableCell>
                                                <TableSortLabel
                                                    active={sortConfig.key === "ticker"}
                                                    direction={sortConfig.key === "ticker" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("ticker")}
                                                >
                                                    Ticker
                                                </TableSortLabel>
                                            </TableCell>
                                        )}
                                        {visibleColumns.source && (
                                            <TableCell>
                                                <TableSortLabel
                                                    active={sortConfig.key === "source"}
                                                    direction={sortConfig.key === "source" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("source")}
                                                >
                                                    Source
                                                </TableSortLabel>
                                            </TableCell>
                                        )}
                                        {visibleColumns.tradeType && (
                                            <TableCell>
                                                <TableSortLabel
                                                    active={sortConfig.key === "tradeType"}
                                                    direction={sortConfig.key === "tradeType" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("tradeType")}
                                                >
                                                    Type
                                                </TableSortLabel>
                                            </TableCell>
                                        )}
                                        {visibleColumns.totalQuantity && (
                                            <TableCell>
                                                <TableSortLabel
                                                    active={sortConfig.key === "totalQuantity"}
                                                    direction={sortConfig.key === "totalQuantity" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("totalQuantity")}
                                                >
                                                    Total Quantity
                                                </TableSortLabel>
                                            </TableCell>
                                        )}
                                        {visibleColumns.totalCost && (
                                            <TableCell>
                                                <TableSortLabel
                                                    active={sortConfig.key === "totalCost"}
                                                    direction={sortConfig.key === "totalCost" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("totalCost")}
                                                >
                                                    Net Cost
                                                </TableSortLabel>
                                            </TableCell>
                                        )}
                                        {visibleColumns.lastPrice && (
                                            <TableCell>
                                                <TableSortLabel
                                                    active={sortConfig.key === "lastPrice"}
                                                    direction={sortConfig.key === "lastPrice" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("lastPrice")}
                                                >
                                                    Last Trade Price
                                                </TableSortLabel>
                                            </TableCell>
                                        )}
                                        {visibleColumns.currentPrice && (
                                            <TableCell>
                                                <TableSortLabel
                                                    active={sortConfig.key === "currentPrice"}
                                                    direction={sortConfig.key === "currentPrice" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("currentPrice")}
                                                >
                                                    Current Price
                                                </TableSortLabel>
                                            </TableCell>
                                        )}
                                        {visibleColumns.profit && (
                                            <TableCell>
                                                <TableSortLabel
                                                    active={sortConfig.key === "profit"}
                                                    direction={sortConfig.key === "profit" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("profit")}
                                                >
                                                    Profit
                                                </TableSortLabel>
                                            </TableCell>
                                        )}
                                        {visibleColumns.profitPercentage && (
                                            <TableCell sx={{borderRight: "3px solid gray"}}>
                                                <TableSortLabel
                                                    active={sortConfig.key === "profitPercentage"}
                                                    direction={sortConfig.key === "profitPercentage" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("profitPercentage")}
                                                >
                                                    Profit (%)
                                                </TableSortLabel>
                                            </TableCell>
                                        )}
                                        {visibleColumns.changeToday && (
                                            <TableCell>
                                                <TableSortLabel
                                                    active={sortConfig.key === "changeToday"}
                                                    direction={sortConfig.key === "changeToday" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("changeToday")}
                                                >
                                                    Change Today
                                                </TableSortLabel>
                                            </TableCell>
                                        )}
                                        {visibleColumns.changeTodayPercentage && (
                                            <TableCell>
                                                <TableSortLabel
                                                    active={sortConfig.key === "changeTodayPercentage"}
                                                    direction={sortConfig.key === "changeTodayPercentage" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("changeTodayPercentage")}
                                                >
                                                    Change Today (%)
                                                </TableSortLabel>
                                            </TableCell>
                                        )}
                                        {visibleColumns.holdingPeriod && (
                                            <TableCell>
                                                <TableSortLabel
                                                    active={sortConfig.key === "holdingPeriod"}
                                                    direction={sortConfig.key === "holdingPeriod" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("holdingPeriod")}
                                                >
                                                    Holding Period (days)
                                                </TableSortLabel>
                                            </TableCell>
                                        )}
                                        {visibleColumns.tradeCount && (
                                            <TableCell>
                                                <TableSortLabel
                                                    active={sortConfig.key === "tradeCount"}
                                                    direction={sortConfig.key === "tradeCount" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("tradeCount")}
                                                >
                                                    Trade Count
                                                </TableSortLabel>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                </TableHead>

                                <TableBody>
                                    {filteredData.map((trade) => {
                                        const profit = trade.profit !== null ? Number(trade.profit) : 0;
                                        const changePct =
                                            trade.changeTodayPercentage !== null ? Number(trade.changeTodayPercentage) : 0;

                                        const highlight =
                                            highlightSignificant && (Math.abs(profit) > 1000 || Math.abs(changePct) > 5);
                                        // Use !important to force the background style
                                        const highlightStyle = highlight
                                            ? {backgroundColor: `${darkMode ? "#ff8c00" : "lightyellow"} !important`}
                                            : {};
                                        return (
                                            <TableRow
                                                key={`${trade.ticker}-${trade.source}-${trade.tradeType}`}
                                                sx={highlightStyle}
                                            >
                                                {visibleColumns.ticker && <TableCell>{trade.ticker}</TableCell>}
                                                {visibleColumns.source && <TableCell>{trade.source}</TableCell>}
                                                {visibleColumns.tradeType && <TableCell>{trade.tradeType}</TableCell>}
                                                {visibleColumns.totalQuantity && (
                                                    <TableCell
                                                        sx={{
                                                            color: trade.totalQuantity === 0 ? "blue" : "inherit",
                                                            fontWeight: trade.totalQuantity === 0 ? "bold" : "normal",
                                                        }}
                                                    >
                                                        {trade.totalQuantity === 0
                                                            ? "Closed"
                                                            : Number(trade.totalQuantity).toLocaleString()}
                                                    </TableCell>
                                                )}
                                                {visibleColumns.totalCost && (
                                                    <TableCell>${formatNumber(trade.totalCost)}</TableCell>
                                                )}
                                                {visibleColumns.lastPrice && (
                                                    <TableCell>
                                                        {trade.lastPrice ? `$${formatNumber(trade.lastPrice)}` : "N/A"}
                                                    </TableCell>
                                                )}
                                                {visibleColumns.currentPrice && (
                                                    <TableCell>
                                                        {trade.updating ? (
                                                            <CircularProgress size={16}/>
                                                        ) : trade.currentPrice !== null && trade.currentPrice !== undefined ? (
                                                            <span style={{color: darkMode ? "white" : "black"}}>
                                ${formatNumber(trade.currentPrice)}
                              </span>
                                                        ) : (
                                                            <span style={{color: "lightgray"}}>N/A</span>
                                                        )}
                                                    </TableCell>
                                                )}
                                                {visibleColumns.profit && (
                                                    <TableCell>
                                                        {trade.updating ? (
                                                            <CircularProgress size={16}/>
                                                        ) : trade.profit !== null ? (
                                                            <span
                                                                style={{color: Number(trade.profit) >= 0 ? "green" : "red"}}>
                                ${formatNumber(trade.profit)}
                              </span>
                                                        ) : (
                                                            <span style={{color: "lightgray"}}>N/A</span>
                                                        )}
                                                    </TableCell>
                                                )}
                                                {visibleColumns.profitPercentage && (
                                                    <TableCell sx={{borderRight: "3px solid gray"}}>
                                                        {trade.updating ? (
                                                            <CircularProgress size={16}/>
                                                        ) : trade.profitPercentage !== null ? (
                                                            <span
                                                                style={{color: Number(trade.profitPercentage) >= 0 ? "green" : "red"}}>
                                {formatNumber(trade.profitPercentage)}%
                              </span>
                                                        ) : (
                                                            <span style={{color: "lightgray"}}>N/A</span>
                                                        )}
                                                    </TableCell>
                                                )}
                                                {visibleColumns.changeToday && (
                                                    <TableCell>
                                                        {trade.updating ? (
                                                            <CircularProgress size={16}/>
                                                        ) : trade.changeToday !== null && trade.changeToday !== undefined ? (
                                                            <span
                                                                style={{color: Number(trade.changeToday) >= 0 ? "green" : "red"}}>
                                ${formatNumber(trade.changeToday)}
                              </span>
                                                        ) : (
                                                            <span style={{color: "lightgray"}}>N/A</span>
                                                        )}
                                                    </TableCell>
                                                )}
                                                {visibleColumns.changeTodayPercentage && (
                                                    <TableCell>
                                                        {trade.updating ? (
                                                            <CircularProgress size={16}/>
                                                        ) : trade.changeTodayPercentage !== null && trade.changeTodayPercentage !== undefined ? (
                                                            <span
                                                                style={{color: Number(trade.changeTodayPercentage) >= 0 ? "green" : "red"}}>
                                {formatNumber(trade.changeTodayPercentage)}%
                              </span>
                                                        ) : (
                                                            <span style={{color: "lightgray"}}>N/A</span>
                                                        )}
                                                    </TableCell>
                                                )}
                                                {visibleColumns.holdingPeriod && (
                                                    <TableCell>
                                                        {trade.holdingPeriod !== null ? trade.holdingPeriod : "N/A"}
                                                    </TableCell>
                                                )}
                                                {visibleColumns.tradeCount && (
                                                    <TableCell>
                                                        {trade.tradeCount !== undefined
                                                            ? Number(trade.tradeCount).toLocaleString()
                                                            : trade.trades
                                                                ? trade.trades.length
                                                                : "N/A"}
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>

                                <TableFooter>
                                    <TableRow sx={{borderTop: "3px solid", borderColor: "divider"}}>
                                        {visibleColumns.ticker && <TableCell>Totals</TableCell>}
                                        {visibleColumns.source && <TableCell/>}
                                        {visibleColumns.tradeType && <TableCell/>}
                                        {visibleColumns.totalQuantity && (
                                            <TableCell>
                                                {totals.totalQuantity === 0
                                                    ? "Closed"
                                                    : Number(totals.totalQuantity).toLocaleString()}
                                            </TableCell>
                                        )}
                                        {visibleColumns.totalCost && (
                                            <TableCell>${formatNumber(totals.totalCost)}</TableCell>
                                        )}
                                        {visibleColumns.lastPrice && <TableCell/>}
                                        {visibleColumns.currentPrice && <TableCell/>}
                                        {visibleColumns.profit && (
                                            <TableCell sx={{color: totals.profit >= 0 ? "green" : "red"}}>
                                                ${formatNumber(totals.profit)}
                                            </TableCell>
                                        )}
                                        {visibleColumns.profitPercentage && (
                                            <TableCell sx={{borderRight: "3px solid gray"}}></TableCell>
                                        )}
                                        {visibleColumns.changeToday && (
                                            <TableCell sx={{color: totals.changeToday >= 0 ? "green" : "red"}}>
                                                ${formatNumber(totals.changeToday)}
                                            </TableCell>
                                        )}
                                        {visibleColumns.changeTodayPercentage && (
                                            <TableCell
                                                sx={{color: totals.changeTodayPercentage >= 0 ? "green" : "red"}}>
                                                {formatNumber(totals.changeTodayPercentage)}%
                                            </TableCell>
                                        )}
                                        {visibleColumns.holdingPeriod && <TableCell/>}
                                        {visibleColumns.tradeCount && (
                                            <TableCell>{Number(totals.tradeCount).toLocaleString()}</TableCell>
                                        )}
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </Box>
                    </TableContainer>
                )}
            </Container>
        </Box>
    );
}

export default SummaryPage;
