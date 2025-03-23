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
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import {jsPDF} from "jspdf";
import html2canvas from "html2canvas";

// Utility function for formatting numbers
const formatNumber = (num, decimals = 2, locale = "en-US") =>
    Number(num).toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });

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
    // Remove includeClosed and use a multi-select for position status instead.
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

    // Define columns configuration with formatting that references colors from the object.
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
            key: "currentMarketValue",
            label: "Current Market Value",
            defaultVisible: true,
            format: (row) =>
                row.netQuantity != null && row.currentPrice != null
                    ? `$${formatNumber(row.netQuantity * row.currentPrice)}`
                    : <span style={{color: "lightgray"}}>N/A</span>,
        },
        {
            key: "currentPrice",
            label: "Current Price",
            defaultVisible: false,
            format: (row) =>
                row.updating ? (
                    <CircularProgress size={16}/>
                ) : row.currentPrice != null ? (
                    `$${formatNumber(row.currentPrice)}`
                ) : (
                    <span style={{color: "lightgray"}}>N/A</span>
                ),
        },
        {
            key: "profit",
            label: "Profit",
            defaultVisible: true,
            format: (row) =>
                row.updating ? (
                    <CircularProgress size={16}/>
                ) : row.profit != null && !Number.isNaN(Number(row.profit)) ? (
                    <span style={{color: row.profit >= 0 ? colors.positive : colors.negative}}>
            ${formatNumber(row.profit)}
          </span>
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
                ) : row.profitPercentage != null && !Number.isNaN(Number(row.profitPercentage)) ? (
                    <span style={{color: row.profitPercentage >= 0 ? colors.positive : colors.negative}}>
            {formatNumber(row.profitPercentage)}%
          </span>
                ) : (
                    <span style={{color: "lightgray"}}>N/A</span>
                ),
            footer: () => "",
        },
        {
            key: "changeToday",
            label: "Latest Change",
            defaultVisible: true,
            format: (row) =>
                row.changeToday != null ? (
                    <span style={{color: row.changeToday >= 0 ? colors.positive : colors.negative}}>
            ${formatNumber(row.changeToday)}
          </span>
                ) : (
                    <span style={{color: "lightgray"}}>N/A</span>
                ),
        },
        {
            key: "changeTodayPercentage",
            label: "Latest Change (%)",
            defaultVisible: true,
            format: (row) =>
                row.changeTodayPercentage != null ? (
                    <span style={{color: row.changeTodayPercentage >= 0 ? colors.positive : colors.negative}}>
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

    // Control which columns are visible.
    const [visibleColumns, setVisibleColumns] = useState(
        columns.reduce((acc, col) => {
            acc[col.key] = col.defaultVisible;
            return acc;
        }, {})
    );

    // Fetch holdings data on mount and aggregate metrics.
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

    // Auto-refresh if enabled.
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

    // Update current prices for open holdings.
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
                    // For closed positions, set profit values directly.
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

    // Apply sorting using our custom hook.
    const {items: sortedData, sortConfig, requestSort} = useSortableData(holdingsData);

    // Filter holdings based on search input and selected position status.
    const filteredData = useMemo(() => {
        const searchTerms = search.toLowerCase().split(" ").filter((term) => term);
        return sortedData.filter((holding) => {
            const tradeSourceValue = `${holding.source} ${holding.tradeType || ""}`.toLowerCase();
            const matchesSearch = searchTerms.every(
                (term) =>
                    holding.ticker.toLowerCase().includes(term) || tradeSourceValue.includes(term)
            );
            const isOpen = holding.netQuantity !== 0;
            const isClosed = holding.netQuantity === 0;
            const includeHolding =
                (selectedPositions.includes("open") && isOpen) ||
                (selectedPositions.includes("closed") && isClosed);
            return matchesSearch && includeHolding;
        });
    }, [sortedData, search, selectedPositions]);

    // Calculate totals.
    const filteredTotals = useMemo(
        () =>
            filteredData.reduce(
                (acc, holding) => {
                    acc.netQuantity += Number(holding.netQuantity) || 0;
                    acc.netCost += Number(holding.netCost) || 0;
                    acc.profit += holding.profit != null ? Number(holding.profit) : 0;
                    acc.tradeCount += Number(holding.tradeCount) || 0;
                    acc.currentMarketValue +=
                        holding.netQuantity != null && holding.currentPrice != null
                            ? holding.netQuantity * holding.currentPrice
                            : 0;
                    return acc;
                },
                {netQuantity: 0, netCost: 0, profit: 0, tradeCount: 0, currentMarketValue: 0}
            ),
        [filteredData]
    );

    // Calculate totals using the full sortedData array rather than filteredData.
    const overallTotals = useMemo(
        () =>
            sortedData.filter((holding) => !holding.updating).reduce(
                (acc, holding) => {
                    acc.netQuantity += Number(holding.netQuantity) || 0;
                    acc.netCost += Number(holding.netCost) || 0;
                    const profit = Number(holding.profit);
                    acc.profit += !Number.isNaN(profit) ? profit : 0;
                    acc.tradeCount += Number(holding.tradeCount) || 0;
                    acc.currentMarketValue +=
                        holding.netQuantity != null && holding.currentPrice != null
                            ? holding.netQuantity * holding.currentPrice
                            : 0;
                    return acc;
                },
                {netQuantity: 0, netCost: 0, profit: 0, tradeCount: 0, currentMarketValue: 0}
            ),
        [sortedData]
    );

    const localProfitPercentage =
        overallTotals.netCost !== 0 ? (overallTotals.profit / overallTotals.netCost) * 100 : null;
    const localProfit = overallTotals.netCost !== 0 ? overallTotals.profit : null;
    const localChangeToday = sortedData.reduce(
        (sum, holding) => sum + (holding.changeToday || 0),
        0
    );
    const localChangeTodayPercentage =
        overallTotals.netCost !== 0 ? (localChangeToday / overallTotals.netCost) * 100 : null;

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
                            <Typography variant="h6">Overall Metrics</Typography>
                            <Typography variant="body1">
                                Total Net Cash: ${formatNumber(aggregateData.overall?.totalNetCost || 0)}
                            </Typography>
                            <Typography variant="body1">
                                Net Cash (Personal Interactive): $
                                {formatNumber(aggregateData.netCash?.netCashPersonalInteractive || 0)}
                            </Typography>
                            <Typography variant="body1">
                                Net Cash (Personal One Zero): $
                                {formatNumber(aggregateData.netCash?.netCashPersonalOneZero || 0)}
                            </Typography>
                            <Typography variant="body1">
                                Net Cash (Joint Interactive): $
                                {formatNumber(aggregateData.netCash?.netCashJointInteractive || 0)}
                            </Typography>
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
                            <Typography variant="h6">Calculated Performance Metrics</Typography>
                            <Typography variant="body1">
                                Total Profit Percentage:{" "}
                                {localProfitPercentage != null && !Number.isNaN(localProfitPercentage) ? (
                                    <span
                                        style={{color: localProfitPercentage >= 0 ? colors.positive : colors.negative}}>
                    {formatNumber(localProfitPercentage)}%
                  </span>
                                ) : (
                                    "N/A"
                                )}
                            </Typography>
                            <Typography variant="body1">
                                Total Profit:{" "}
                                {localProfit != null && !Number.isNaN(localProfit) ? (
                                    <span style={{color: localProfit >= 0 ? colors.positive : colors.negative}}>
                    ${formatNumber(localProfit)}
                  </span>
                                ) : (
                                    "N/A"
                                )}
                            </Typography>
                            <Typography variant="body1">
                                Change Today:{" "}
                                <span style={{color: localChangeToday >= 0 ? colors.positive : colors.negative}}>
                  ${formatNumber(localChangeToday)}
                </span>
                            </Typography>
                            <Typography variant="body1">
                                Change Today Percentage:{" "}
                                {localChangeTodayPercentage != null ? (
                                    <span
                                        style={{color: localChangeTodayPercentage >= 0 ? colors.positive : colors.negative}}>
                    {formatNumber(localChangeTodayPercentage)}%
                  </span>
                                ) : (
                                    "N/A"
                                )}
                            </Typography>
                        </Paper>
                    </Box>
                ) : null}

                {/* Search, Position Filter, and Columns Filter Icon Row */}
                <Box sx={{display: "flex", alignItems: "center", mb: 2}}>
                    <TextField
                        label="Search by Ticker, Source, or Type"
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
                                        if (col.key === "netCost") {
                                            cellContent = `$${formatNumber(filteredTotals.netCost)}`;
                                        } else if (col.key === "currentMarketValue") {
                                            cellContent = `$${formatNumber(filteredTotals.currentMarketValue)}`;
                                        } else if (col.key === "profit") {
                                            cellContent = (
                                                <span
                                                    style={{color: filteredTotals.profit >= 0 ? colors.positive : colors.negative}}
                                                >
                          ${formatNumber(filteredTotals.profit)}
                        </span>
                                            );
                                        } else if (col.key === "changeToday") {
                                            cellContent = `$${formatNumber(localChangeToday)}`;
                                        } else if (index === 0) {
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
