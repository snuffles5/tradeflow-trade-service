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
        minimumFractionDigits: decimals, maximumFractionDigits: decimals,
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
        tradeSource: true,
        netQuantity: false,
        netCost: true,
        latestTradePrice: true,
        currentPrice: true,
        profit: true,
        profitPercentage: true,
        changeToday: true,
        changeTodayPercentage: true,
        holdingPeriod: false,
        tradeCount: false,
    });
    const [includeClosed, setIncludeClosed] = useState(false);
    // Extra settings options
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [darkMode, setDarkMode] = useState(false);
    const [highlightSignificant, setHighlightSignificant] = useState(true);

    // Fetch holdings data on mount
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

        // Fetch aggregated metrics from holdings-summary
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

    // Auto-refresh holdings data if enabled
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
            }, 60000);
            return () => clearInterval(interval);
        }
    }, [autoRefresh]);

    // For each open holding, update current price via stock-info endpoint
    useEffect(() => {
        if (!loading && holdingsData.length > 0 && !priceUpdatesLaunched) {
            setPriceUpdatesLaunched(true);
            holdingsData.forEach((holding, index) => {
                if (holding.netQuantity !== 0) {  // Only update open positions
                    setHoldingsData((prev) => {
                        const newData = [...prev];
                        newData[index] = {...newData[index], updating: true};
                        return newData;
                    });
                    fetch(`${process.env.REACT_APP_API_URL}/stock-info/${holding.ticker}`)
                        .then((res) => res.json())
                        .then((data) => {
                            const currentPrice = data.lastPrice;
                            const changeToday = data.changeToday;
                            const changeTodayPercentage = data.changeTodayPercentage;
                            const avgCost = holding.averageCost;

                            const updatedProfit = (currentPrice - avgCost) * holding.netQuantity;
                            const updatedProfitPercentage = ((currentPrice - avgCost) / avgCost) * 100;

                            setHoldingsData((prev) => {
                                const newData = [...prev];
                                newData[index] = {
                                    ...newData[index],
                                    currentPrice,
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
                } else { // For closed positions explicitly set profit values (from backend ideally)
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

    // Sort holdings data based on sortConfig
    const sortedData = [...holdingsData].sort((a, b) => {
        let aValue, bValue;
        if (sortConfig.key === "tradeSource") {
            aValue = `${a.source || ""}${a.tradeType ? ` (${a.tradeType})` : ""}`.trim();
            bValue = `${b.source} ${b.tradeType || ""}`.trim();
        } else {
            aValue = a[sortConfig.key] ?? "";
            bValue = b[sortConfig.key] ?? "";
        }

        if (typeof aValue === "number" && typeof bValue === "number") {
            return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
        }

        return sortConfig.direction === "asc" ? String(aValue).localeCompare(String(bValue)) : String(bValue).localeCompare(String(aValue));
    });

    // Filter holdings based on search terms
    const filteredData = sortedData.filter((holding) => {
        const searchTerms = search.toLowerCase().split(" ").filter((term) => term);
        const tradeSourceValue = `${holding.source} ${holding.tradeType || ""}`.toLowerCase();
        const matchesSearch = searchTerms.every((term) => holding.ticker.toLowerCase().includes(term) || tradeSourceValue.includes(term));
        const includeHolding = includeClosed ? true : holding.netQuantity !== 0;
        return matchesSearch && includeHolding;
    });


    // Calculate totals from filtered data
    const totals = filteredData.reduce((acc, holding) => {
        acc.netQuantity += Number(holding.netQuantity) || 0;
        acc.netCost += Number(holding.netCost) || 0;
        acc.profit += holding.profit !== null ? Number(holding.profit) : 0;
        acc.tradeCount += Number(holding.tradeCount) || 0;
        return acc;
    }, {netQuantity: 0, netCost: 0, profit: 0, tradeCount: 0});

    const handleSort = (key) => {
        setSortConfig((prev) => ({
            key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
        }));
    };

    const exportToPDF = () => {
        const input = document.getElementById("exportableContent");
        if (!input) return;
        html2canvas(input, {scale: 2}).then((canvas) => {
            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF({
                orientation: "landscape", unit: "px", format: [canvas.width, canvas.height],
            });
            pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
            pdf.save("holdings_summary.pdf");
        });
    };

    // Define columns for the table and filter dropdown.
    const columns = [{key: "ticker", label: "Ticker"}, {key: "tradeSource", label: "Trade Source"}, // Merged source & type
        {key: "netQuantity", label: "Net Quantity"}, {key: "netCost", label: "Net Cost"}, {
            key: "latestTradePrice",
            label: "Latest Trade Price"
        }, {key: "currentPrice", label: "Current Price"}, {key: "profit", label: "Profit"}, {
            key: "profitPercentage",
            label: "Profit (%)"
        }, {key: "changeToday", label: "Change Today"}, {
            key: "changeTodayPercentage",
            label: "Change Today (%)"
        }, {key: "holdingPeriod", label: "Holding Period (days)"}, {key: "tradeCount", label: "Trade Count"},];

    return (<Box
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
                    mt: 4, backgroundColor: darkMode ? "#333" : "inherit", color: darkMode ? "white" : "inherit",
                }}
            >
                <Typography variant="h4" gutterBottom>
                    Holdings Summary
                </Typography>

                {/* Aggregated Metrics Section */}
                {aggLoading ? (<CircularProgress/>) : aggregateData ? (<Paper
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
                            {aggregateData.overall?.totalProfitPercentage !== null && aggregateData.overall?.totalProfitPercentage !== undefined ? `${formatNumber(aggregateData.overall.totalProfitPercentage)}%` : "N/A"}
                        </Typography>
                        <Typography variant="body1">
                            Change Today: ${formatNumber(aggregateData.overall?.changeToday || 0)}
                        </Typography>
                        <Typography variant="body1">
                            Change Today Percentage:{" "}
                            {aggregateData.overall?.changeTodayPercentage !== null && aggregateData.overall?.changeTodayPercentage !== undefined ? `${formatNumber(aggregateData.overall.changeTodayPercentage)}%` : "N/A"}
                        </Typography>
                    </Paper>) : null}

                {/* Settings Bar */}
                <Box
                    sx={{
                        display: "flex", alignItems: "center", mb: 2, border: "1px solid lightgray", p: 1,
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
                                    newVisible[col.key] = col.key === "ticker" ? true : selected.includes(col.key);
                                });
                                setVisibleColumns(newVisible);
                            }}
                            renderValue={(selected) => selected.length > 3 ? `${selected.slice(0, 3).map((key) => columns.find((col) => col.key === key)?.label).join(", ")}...` : selected.map((key) => columns.find((col) => col.key === key)?.label).join(", ")}
                        >
                            {columns.map((col) => (<MenuItem key={col.key} value={col.key}>
                                    <Checkbox checked={visibleColumns[col.key]} disabled={col.key === "ticker"}/>
                                    <ListItemText primary={col.label}/>
                                </MenuItem>))}
                        </Select>

                    </FormControl>
                    <FormControlLabel
                        control={<Checkbox
                            sx={{mr: 2, color: darkMode ? "white" : "inherit"}}
                            checked={includeClosed}
                            onChange={(e) => setIncludeClosed(e.target.checked)}
                        />}
                        label="Include Closed Positions"
                        sx={{mr: 2}}
                    />
                    {/* Extra Options */}
                    <FormControlLabel
                        control={<Checkbox
                            sx={{mr: 2, color: darkMode ? "white" : "inherit"}}
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                        />}
                        label="Auto Refresh"
                        sx={{mr: 2}}
                    />
                    <FormControlLabel
                        control={<Checkbox
                            sx={{mr: 2, color: darkMode ? "white" : "inherit"}}
                            checked={darkMode}
                            onChange={(e) => setDarkMode(e.target.checked)}
                        />}
                        label="Dark Mode"
                        sx={{mr: 2}}
                    />
                    <FormControlLabel
                        control={<Checkbox
                            sx={{mr: 2, color: darkMode ? "white" : "inherit"}}
                            checked={highlightSignificant}
                            onChange={(e) => setHighlightSignificant(e.target.checked)}
                        />}
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
                {loading ? (<CircularProgress/>) : (<TableContainer
                        component={Paper}
                        sx={{
                            backgroundColor: darkMode ? "#333" : "inherit", color: darkMode ? "white" : "inherit",
                        }}
                    >
                        <Box
                            sx={{
                                "& .MuiTableCell-root": {
                                    color: darkMode ? "white" : "inherit",
                                    backgroundColor: darkMode ? "#333" : "inherit",
                                }, "& .MuiTableRow-root": {
                                    backgroundColor: darkMode ? "#333" : "inherit",
                                },
                            }}
                        >
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        {visibleColumns.ticker && (<TableCell>
                                                <TableSortLabel
                                                    active={sortConfig.key === "ticker"}
                                                    direction={sortConfig.key === "ticker" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("ticker")}
                                                >
                                                    Ticker
                                                </TableSortLabel>
                                            </TableCell>)}
                                        {visibleColumns.tradeSource && (<TableCell>
                                                <TableSortLabel
                                                    active={sortConfig.key === "tradeSource"}
                                                    direction={sortConfig.key === "tradeSource" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("tradeSource")}
                                                >
                                                    Trade Source
                                                </TableSortLabel>
                                            </TableCell>)}

                                        {visibleColumns.netQuantity && (<TableCell>
                                                <TableSortLabel
                                                    active={sortConfig.key === "netQuantity"}
                                                    direction={sortConfig.key === "netQuantity" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("netQuantity")}
                                                >
                                                    Net Quantity
                                                </TableSortLabel>
                                            </TableCell>)}
                                        {visibleColumns.netCost && (<TableCell>
                                                <TableSortLabel
                                                    active={sortConfig.key === "netCost"}
                                                    direction={sortConfig.key === "netCost" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("netCost")}
                                                >
                                                    Net Cost
                                                </TableSortLabel>
                                            </TableCell>)}
                                        {visibleColumns.latestTradePrice && (<TableCell>
                                                <TableSortLabel
                                                    active={sortConfig.key === "latestTradePrice"}
                                                    direction={sortConfig.key === "latestTradePrice" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("latestTradePrice")}
                                                >
                                                    Latest Trade Price
                                                </TableSortLabel>
                                            </TableCell>)}
                                        {visibleColumns.currentPrice && (<TableCell>
                                                <TableSortLabel
                                                    active={sortConfig.key === "currentPrice"}
                                                    direction={sortConfig.key === "currentPrice" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("currentPrice")}
                                                >
                                                    Current Price
                                                </TableSortLabel>
                                            </TableCell>)}
                                        {visibleColumns.profit && (<TableCell>
                                                <TableSortLabel
                                                    active={sortConfig.key === "profit"}
                                                    direction={sortConfig.key === "profit" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("profit")}
                                                >
                                                    Profit
                                                </TableSortLabel>
                                            </TableCell>)}
                                        {visibleColumns.profitPercentage && (
                                            <TableCell sx={{borderRight: "3px solid gray"}}>
                                                <TableSortLabel
                                                    active={sortConfig.key === "profitPercentage"}
                                                    direction={sortConfig.key === "profitPercentage" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("profitPercentage")}
                                                >
                                                    Profit (%)
                                                </TableSortLabel>
                                            </TableCell>)}
                                        {visibleColumns.changeToday && (<TableCell>
                                                <TableSortLabel
                                                    active={sortConfig.key === "changeToday"}
                                                    direction={sortConfig.key === "changeToday" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("changeToday")}
                                                >
                                                    Change Today
                                                </TableSortLabel>
                                            </TableCell>)}
                                        {visibleColumns.changeTodayPercentage && (<TableCell>
                                                <TableSortLabel
                                                    active={sortConfig.key === "changeTodayPercentage"}
                                                    direction={sortConfig.key === "changeTodayPercentage" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("changeTodayPercentage")}
                                                >
                                                    Change Today (%)
                                                </TableSortLabel>
                                            </TableCell>)}
                                        {visibleColumns.holdingPeriod && (<TableCell>
                                                <TableSortLabel
                                                    active={sortConfig.key === "holdingPeriod"}
                                                    direction={sortConfig.key === "holdingPeriod" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("holdingPeriod")}
                                                >
                                                    Holding Period (days)
                                                </TableSortLabel>
                                            </TableCell>)}
                                        {visibleColumns.tradeCount && (<TableCell>
                                                <TableSortLabel
                                                    active={sortConfig.key === "tradeCount"}
                                                    direction={sortConfig.key === "tradeCount" ? sortConfig.direction : "asc"}
                                                    onClick={() => handleSort("tradeCount")}
                                                >
                                                    Trade Count
                                                </TableSortLabel>
                                            </TableCell>)}
                                    </TableRow>
                                </TableHead>

                                <TableBody>
                                    {filteredData.map((holding) => {
                                        return (<TableRow key={holding.id}>
                                                {visibleColumns.ticker && <TableCell>{holding.ticker}</TableCell>}
                                                {visibleColumns.tradeSource && (<TableCell>
                                                        {`${holding.source}${holding.tradeType ? ` (${holding.tradeType})` : ""}`}
                                                    </TableCell>)}
                                                {visibleColumns.netQuantity && (<TableCell
                                                        sx={{
                                                            color: holding.netQuantity === 0 ? "blue" : "inherit",
                                                            fontWeight: holding.netQuantity === 0 ? "bold" : "normal",
                                                        }}
                                                    >
                                                        {holding.netQuantity === 0 ? "Closed" : Number(holding.netQuantity).toLocaleString()}
                                                    </TableCell>)}
                                                {visibleColumns.netCost && (
                                                    <TableCell>${formatNumber(holding.netCost)}</TableCell>)}
                                                {visibleColumns.latestTradePrice && (<TableCell>
                                                        {holding.latestTradePrice ? `$${formatNumber(holding.latestTradePrice)}` : "N/A"}
                                                    </TableCell>)}
                                                {visibleColumns.currentPrice && (<TableCell>
                                                        {holding.updating ? (<CircularProgress
                                                                size={16}/>) : holding.currentPrice != null ? (
                                                            <span>${formatNumber(holding.currentPrice)}</span>) : (
                                                            <span style={{color: "lightgray"}}>N/A</span>)}
                                                    </TableCell>)}

                                                {visibleColumns.profit && (<TableCell>
                                                        {holding.updating ? (<CircularProgress
                                                                size={16}/>) : holding.profit !== null && holding.profit !== undefined ? (
                                                            <span
                                                                style={{color: holding.profit >= 0 ? "green" : "red"}}>
                                                    ${formatNumber(holding.profit)}
                                                  </span>) : (<span style={{color: "lightgray"}}>N/A</span>)}
                                                    </TableCell>)}

                                                {visibleColumns.profitPercentage && (
                                                    <TableCell sx={{borderRight: "3px solid gray"}}>
                                                        {holding.updating ? (<CircularProgress
                                                                size={16}/>) : holding.profitPercentage !== null && holding.profitPercentage !== undefined ? (
                                                            <span
                                                                style={{color: holding.profitPercentage >= 0 ? "green" : "red"}}>
                                                    {formatNumber(holding.profitPercentage)}%
                                                  </span>) : (<span style={{color: "lightgray"}}>N/A</span>)}
                                                    </TableCell>)}

                                                {visibleColumns.changeToday && (<TableCell>
                                                        {holding.changeToday !== undefined && holding.changeToday !== null ? (
                                                            <span
                                                                style={{color: holding.changeToday >= 0 ? "green" : "red"}}>
                                                    ${formatNumber(holding.changeToday)}
                                                  </span>) : (<span style={{color: "lightgray"}}>N/A</span>)}
                                                    </TableCell>)}

                                                {visibleColumns.changeTodayPercentage && (<TableCell>
                                                        {holding.changeTodayPercentage !== null && holding.changeTodayPercentage !== undefined ? (
                                                            <span
                                                                style={{color: holding.changeTodayPercentage >= 0 ? "green" : "red"}}>
                                                    {formatNumber(holding.changeTodayPercentage)}%
                                                  </span>) : (<span style={{color: "lightgray"}}>N/A</span>)}
                                                    </TableCell>)}
                                                {visibleColumns.holdingPeriod && (<TableCell>
                                                        {holding.holdingPeriod !== null ? holding.holdingPeriod : "N/A"}
                                                    </TableCell>)}
                                                {visibleColumns.tradeCount && (<TableCell>
                                                        {holding.tradeCount !== undefined ? Number(holding.tradeCount).toLocaleString() : "N/A"}
                                                    </TableCell>)}
                                            </TableRow>);
                                    })}
                                </TableBody>

                                <TableFooter>
                                    <TableRow sx={{borderTop: "3px solid", borderColor: "divider"}}>
                                        {visibleColumns.ticker && <TableCell>Totals</TableCell>}
                                        {visibleColumns.source && <TableCell/>}
                                        {visibleColumns.tradeType && <TableCell/>}
                                        {visibleColumns.netQuantity && (<TableCell>
                                                {totals.netQuantity === 0 ? "Closed" : Number(totals.netQuantity).toLocaleString()}
                                            </TableCell>)}
                                        {visibleColumns.netCost && (
                                            <TableCell>${formatNumber(totals.netCost)}</TableCell>)}
                                        {visibleColumns.latestTradePrice && <TableCell/>}
                                        {visibleColumns.currentPrice && <TableCell/>}
                                        {visibleColumns.profit && (
                                            <TableCell sx={{color: totals.profit >= 0 ? "green" : "red"}}>
                                                ${formatNumber(totals.profit)}
                                            </TableCell>)}
                                        {visibleColumns.profitPercentage && (
                                            <TableCell sx={{borderRight: "3px solid gray"}}></TableCell>)}
                                        {visibleColumns.changeToday && <TableCell/>}
                                        {visibleColumns.changeTodayPercentage && <TableCell/>}
                                        {visibleColumns.holdingPeriod && <TableCell/>}
                                        {visibleColumns.tradeCount && (
                                            <TableCell>{Number(totals.tradeCount).toLocaleString()}</TableCell>)}
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </Box>
                    </TableContainer>)}
            </Container>
        </Box>);
}

export default SummaryPage;
