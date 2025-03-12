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
const formatNumber = (num, decimals = 2, locale = "en-US") => {
    return Number(num).toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
};

function SummaryPage() {
    const [holdingsData, setHoldingsData] = useState([]);
    const [aggregateData, setAggregateData] = useState(null);
    const [sortConfig, setSortConfig] = useState({key: "netQuantity", direction: "desc"});
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [aggLoading, setAggLoading] = useState(true);
    const [priceUpdatesLaunched, setPriceUpdatesLaunched] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState({
        ticker: true,
        source: true,
        tradeType: true,
        netQuantity: true,
        netCost: true,
        latestTradePrice: true,
        currentPrice: true,
        profit: true,
        profitPercentage: true,
        changeToday: true,
        changeTodayPercentage: true,
        // tradeCount can be omitted if not stored in holdings
    });
    const [includeClosed, setIncludeClosed] = useState(false);
    // Extra settings options
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [darkMode, setDarkMode] = useState(false);
    const [highlightSignificant, setHighlightSignificant] = useState(true);

    useEffect(() => {
        if (autoRefresh) {
            const interval = setInterval(() => {
                fetch(`${process.env.REACT_APP_API_URL}/holdings`)
                    .then((res) => res.json())
                    .then((data) => {
                        setHoldingsData(data);
                    })
                    .catch((err) => {
                        console.error("Error fetching holdings:", err);
                    });
            }, 60000); // Refresh every 60 seconds
            return () => clearInterval(interval);
        }
    }, [autoRefresh]);

    useEffect(() => {
        // Fetch holdings detailed data
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

        // Fetch aggregated metrics
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

    useEffect(() => {
        if (!loading && holdingsData.length > 0 && !priceUpdatesLaunched) {
            setPriceUpdatesLaunched(true);

            // For each open holding, update current price via the stock-info endpoint.
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
                            const changeToday = data.changeToday;
                            const changeTodayPercentage = data.changeTodayPercentage;
                            let updatedProfit, updatedProfitPercentage;
                            if (holding.netQuantity > 0) {
                                updatedProfit = (currentPrice - avgCost) * holding.netQuantity;
                                updatedProfitPercentage = ((currentPrice / avgCost) - 1) * 100;
                            } else {
                                updatedProfit = (avgCost - currentPrice) * Math.abs(holding.netQuantity);
                                updatedProfitPercentage = ((avgCost / currentPrice) - 1) * 100;
                            }
                            setHoldingsData((prev) => {
                                const newData = [...prev];
                                newData[index] = {
                                    ...newData[index],
                                    currentPrice,
                                    profit: updatedProfit,
                                    profitPercentage: updatedProfitPercentage,
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
                }
            });
        }
    }, [loading, holdingsData, priceUpdatesLaunched]);

    const sortedData = [...holdingsData].sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (typeof aValue === "number" && typeof bValue === "number") {
            return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
        }
        const aStr = aValue ? aValue.toString() : "";
        const bStr = bValue ? bValue.toString() : "";
        return sortConfig.direction === "asc"
            ? aStr.localeCompare(bStr)
            : bStr.localeCompare(aStr);
    });

    const filteredData = sortedData.filter((holding) => {
        const searchTerms = search.toLowerCase().split(" ").filter((term) => term);
        const matchesSearch = searchTerms.every(
            (term) =>
                holding.ticker.toLowerCase().includes(term) ||
                holding.source.toLowerCase().includes(term) ||
                holding.tradeType.toLowerCase().includes(term)
        );
        const includeHolding = includeClosed ? true : holding.netQuantity !== 0;
        return matchesSearch && includeHolding;
    });

    const totals = filteredData.reduce(
        (acc, holding) => {
            acc.netQuantity += Number(holding.netQuantity) || 0;
            acc.netCost += Number(holding.netCost) || 0;
            acc.profit += holding.profit !== null ? Number(holding.profit) : 0;
            acc.tradeCount += Number(holding.tradeCount) || 0;
            return acc;
        },
        {netQuantity: 0, netCost: 0, profit: 0, tradeCount: 0}
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
            pdf.save("holdings_summary.pdf");
        });
    };

    const columns = [
        {key: "ticker", label: "Ticker"},
        {key: "source", label: "Source"},
        {key: "tradeType", label: "Type"},
        {key: "netQuantity", label: "Net Quantity"},
        {key: "netCost", label: "Net Cost"},
        {key: "latestTradePrice", label: "Latest Trade Price"},
        {key: "currentPrice", label: "Current Price"},
        {key: "profit", label: "Profit"},
        {key: "profitPercentage", label: "Profit (%)"},
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
                    Holdings Summary
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
                            Total Net Cash: ${formatNumber(aggregateData.overall?.totalNetCost || 0)}
                        </Typography>
                        <Typography variant="body1">
                            Total Profit Percentage:{" "}
                            {aggregateData.overall?.totalProfitPercentage !== null &&
                            aggregateData.overall?.totalProfitPercentage !== undefined
                                ? `${formatNumber(aggregateData.overall.totalProfitPercentage)}%`
                                : "N/A"}
                        </Typography>
                        <Box sx={{mt: 2}}>
                            <Grid container spacing={2}>
                                {/* Breakdown by Source */}
                                <Grid item xs={6}>
                                    <Typography variant="subtitle1">By Source</Typography>
                                    {Object.entries(aggregateData.bySource || {}).map(([source, data]) => (
                                        <Box key={source} sx={{mb: 1}}>
                                            <Typography variant="body2">
                                                <strong>{source}:</strong> Net Cash: $
                                                {formatNumber(data.totalNetCost || 0)} | Profit %:{" "}
                                                {data.profitPercentage !== null && data.profitPercentage !== undefined
                                                    ? `${formatNumber(data.profitPercentage)}%`
                                                    : "N/A"}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Grid>
                                {/* Breakdown by Type */}
                                <Grid item xs={6}>
                                    <Typography variant="subtitle1">By Type</Typography>
                                    {Object.entries(aggregateData.byType || {}).map(([tradeType, data]) => (
                                        <Box key={tradeType} sx={{mb: 1}}>
                                            <Typography variant="body2">
                                                <strong>{tradeType}:</strong> Net Cash: $
                                                {formatNumber(data.totalNetCost || 0)} | Profit %:{" "}
                                                {data.profitPercentage !== null && data.profitPercentage !== undefined
                                                    ? `${formatNumber(data.profitPercentage)}%`
                                                    : "N/A"}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Grid>
                            </Grid>
                        </Box>
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
                                checked={includeClosed}
                                onChange={(e) => setIncludeClosed(e.target.checked)}
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

                {/* Detailed Holdings Table */}
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
                                        {visibleColumns.netQuantity && (
                                            <TableCell>
                                                <TableSortLabel
                                                    active={sortConfig.key === "netQuantity"}
                                                    direction={sortConfig.key === "netQuantity" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("netQuantity")}
                                                >
                                                    Net Quantity
                                                </TableSortLabel>
                                            </TableCell>
                                        )}
                                        {visibleColumns.netCost && (
                                            <TableCell>
                                                <TableSortLabel
                                                    active={sortConfig.key === "netCost"}
                                                    direction={sortConfig.key === "netCost" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("netCost")}
                                                >
                                                    Net Cost
                                                </TableSortLabel>
                                            </TableCell>
                                        )}
                                        {visibleColumns.latestTradePrice && (
                                            <TableCell>
                                                <TableSortLabel
                                                    active={sortConfig.key === "latestTradePrice"}
                                                    direction={sortConfig.key === "latestTradePrice" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("latestTradePrice")}
                                                >
                                                    Latest Trade Price
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
                                    {filteredData.map((holding) => {
                                        const profit = holding.profit !== null ? Number(holding.profit) : 0;
                                        const highlight =
                                            highlightSignificant && (Math.abs(profit) > 1000);
                                        const highlightStyle = highlight
                                            ? {backgroundColor: darkMode ? "#ff8c00" : "lightyellow"}
                                            : {};
                                        return (
                                            <TableRow key={holding.id} sx={highlightStyle}>
                                                {visibleColumns.ticker && <TableCell>{holding.ticker}</TableCell>}
                                                {visibleColumns.source && <TableCell>{holding.source}</TableCell>}
                                                {visibleColumns.tradeType && <TableCell>{holding.tradeType}</TableCell>}
                                                {visibleColumns.netQuantity && (
                                                    <TableCell
                                                        sx={{
                                                            color: holding.netQuantity === 0 ? "blue" : "inherit",
                                                            fontWeight: holding.netQuantity === 0 ? "bold" : "normal",
                                                        }}
                                                    >
                                                        {holding.netQuantity === 0
                                                            ? "Closed"
                                                            : Number(holding.netQuantity).toLocaleString()}
                                                    </TableCell>
                                                )}
                                                {visibleColumns.netCost && (
                                                    <TableCell>${formatNumber(holding.netCost)}</TableCell>
                                                )}
                                                {visibleColumns.latestTradePrice && (
                                                    <TableCell>
                                                        {holding.latestTradePrice
                                                            ? `$${formatNumber(holding.latestTradePrice)}`
                                                            : "N/A"}
                                                    </TableCell>
                                                )}
                                                {visibleColumns.currentPrice && (
                                                    <TableCell>
                                                        {holding.updating ? (
                                                            <CircularProgress size={16}/>
                                                        ) : holding.currentPrice !== null && holding.currentPrice !== undefined ? (
                                                            <span style={{color: darkMode ? "white" : "black"}}>
                                ${formatNumber(holding.currentPrice)}
                              </span>
                                                        ) : (
                                                            <span style={{color: "lightgray"}}>N/A</span>
                                                        )}
                                                    </TableCell>
                                                )}
                                                {visibleColumns.profit && (
                                                    <TableCell>
                                                        {holding.updating ? (
                                                            <CircularProgress size={16}/>
                                                        ) : holding.profit !== null ? (
                                                            <span
                                                                style={{color: Number(holding.profit) >= 0 ? "green" : "red"}}>
                                ${formatNumber(holding.profit)}
                              </span>
                                                        ) : (
                                                            <span style={{color: "lightgray"}}>N/A</span>
                                                        )}
                                                    </TableCell>
                                                )}
                                                {visibleColumns.profitPercentage && (
                                                    <TableCell sx={{borderRight: "3px solid gray"}}>
                                                        {holding.updating ? (
                                                            <CircularProgress size={16}/>
                                                        ) : holding.profitPercentage !== null ? (
                                                            <span
                                                                style={{color: Number(holding.profitPercentage) >= 0 ? "green" : "red"}}>
                                {formatNumber(holding.profitPercentage)}%
                              </span>
                                                        ) : (
                                                            <span style={{color: "lightgray"}}>N/A</span>
                                                        )}
                                                    </TableCell>
                                                )}
                                                {visibleColumns.holdingPeriod && (
                                                    <TableCell>
                                                        {holding.holdingPeriod !== null ? holding.holdingPeriod : "N/A"}
                                                    </TableCell>
                                                )}
                                                {visibleColumns.tradeCount && (
                                                    <TableCell>
                                                        {holding.tradeCount !== undefined
                                                            ? Number(holding.tradeCount).toLocaleString()
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
                                        {visibleColumns.netQuantity && (
                                            <TableCell>
                                                {totals.netQuantity === 0
                                                    ? "Closed"
                                                    : Number(totals.netQuantity).toLocaleString()}
                                            </TableCell>
                                        )}
                                        {visibleColumns.netCost && (
                                            <TableCell>${formatNumber(totals.netCost)}</TableCell>
                                        )}
                                        {visibleColumns.latestTradePrice && <TableCell/>}
                                        {visibleColumns.currentPrice && <TableCell/>}
                                        {visibleColumns.profit && (
                                            <TableCell sx={{color: totals.profit >= 0 ? "green" : "red"}}>
                                                ${formatNumber(totals.profit)}
                                            </TableCell>
                                        )}
                                        {visibleColumns.profitPercentage && (
                                            <TableCell sx={{borderRight: "3px solid gray"}}></TableCell>
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
