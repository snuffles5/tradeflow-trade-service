import React, {useEffect, useState} from "react";
import {
    Container,
    Typography,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    TableContainer,
    Paper,
    TextField,
    TableSortLabel,
    CircularProgress,
    Box,
    Grid,
} from "@mui/material";

function SummaryPage() {
    const [summaryData, setSummaryData] = useState([]);
    const [aggregateData, setAggregateData] = useState(null);
    const [sortConfig, setSortConfig] = useState({key: "totalQuantity", direction: "desc"});
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [aggLoading, setAggLoading] = useState(true);

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

    const sortedData = [...summaryData].sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === "asc" ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
    });

    const filteredData = sortedData.filter((trade) => {
        const searchTerms = search.toLowerCase().split(" ").filter((term) => term);
        return searchTerms.every(
            (term) =>
                trade.ticker.toLowerCase().includes(term) ||
                trade.source.toLowerCase().includes(term) ||
                trade.type.toLowerCase().includes(term)
        );
    });

    const handleSort = (key) => {
        setSortConfig((prev) => ({
            key,
            direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
        }));
    };

    const columns = [
        {key: "ticker", label: "Ticker"},
        {key: "source", label: "Source"},
        {key: "type", label: "Type"},
        {key: "totalQuantity", label: "Total Quantity"},
        {key: "totalCost", label: "Net Cost"},
        {key: "lastPrice", label: "Last Trade Price"},
        {key: "currentPrice", label: "Current Price"},
        {key: "profit", label: "Profit"},
        {key: "profitPercentage", label: "Profit (%)"},
        {key: "holdingPeriod", label: "Holding Period (days)"},
        {key: "tradeCount", label: "Trade Count"},
    ];

    return (
        <Container maxWidth="md" sx={{mt: 4}}>
            <Typography variant="h4" gutterBottom>
                Trades Summary
            </Typography>

            {/* Aggregated Metrics Section */}
            {aggLoading ? (
                <CircularProgress/>
            ) : aggregateData ? (
                <Paper sx={{p: 2, mb: 2}}>
                    <Typography variant="h6">Overall Metrics</Typography>
                    <Typography variant="body1">
                        Total Net Cash: ${aggregateData.overall.totalNetCash.toFixed(2)}
                    </Typography>
                    <Typography variant="body1">
                        Total Profit Percentage:{" "}
                        {aggregateData.overall.totalProfitPercentage !== null
                            ? `${aggregateData.overall.totalProfitPercentage}%`
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
                                            <strong>{source}:</strong> Net Cash: ${data.totalNetCash.toFixed(2)} |
                                            Profit %:{" "}
                                            {data.profitPercentage !== null ? `${data.profitPercentage}%` : "N/A"}
                                        </Typography>
                                    </Box>
                                ))}
                            </Grid>
                            {/* Breakdown by Type */}
                            <Grid item xs={6}>
                                <Typography variant="subtitle1">By Type</Typography>
                                {Object.entries(aggregateData.byType).map(([type, data]) => (
                                    <Box key={type} sx={{mb: 1}}>
                                        <Typography variant="body2">
                                            <strong>{type}:</strong> Net Cash: ${data.totalNetCash.toFixed(2)} | Profit
                                            %:{" "}
                                            {data.profitPercentage !== null ? `${data.profitPercentage}%` : "N/A"}
                                        </Typography>
                                    </Box>
                                ))}
                            </Grid>
                        </Grid>
                    </Box>
                </Paper>
            ) : null}

            {/* Search Filter */}
            <TextField
                label="Search by Ticker, Source, or Type"
                variant="outlined"
                fullWidth
                sx={{mb: 2}}
                onChange={(e) => setSearch(e.target.value)}
            />

            {/* Detailed Summary Table */}
            {loading ? (
                <CircularProgress/>
            ) : (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                {columns.map(({key, label}) => (
                                    <TableCell key={key}>
                                        <TableSortLabel
                                            active={sortConfig.key === key}
                                            direction={sortConfig.key === key ? sortConfig.direction : "asc"}
                                            onClick={() => handleSort(key)}
                                        >
                                            {label}
                                        </TableSortLabel>
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredData.map((trade) => (
                                <TableRow key={`${trade.ticker}-${trade.source}-${trade.type}`}>
                                    <TableCell>{trade.ticker}</TableCell>
                                    <TableCell>{trade.source}</TableCell>
                                    <TableCell>{trade.type}</TableCell>
                                    <TableCell
                                        sx={{
                                            color: trade.totalQuantity === 0 ? "blue" : "inherit",
                                            fontWeight: trade.totalQuantity === 0 ? "bold" : "normal",
                                        }}
                                    >
                                        {trade.totalQuantity === 0 ? "Closed" : trade.totalQuantity}
                                    </TableCell>
                                    <TableCell>${trade.totalCost.toFixed(2)}</TableCell>
                                    <TableCell>{trade.lastPrice ? `$${trade.lastPrice.toFixed(2)}` : "N/A"}</TableCell>
                                    <TableCell>{trade.currentPrice ? `$${trade.currentPrice.toFixed(2)}` : "N/A"}</TableCell>
                                    <TableCell
                                        sx={{
                                            color: trade.profit >= 0 ? "green" : "red",
                                        }}
                                    >
                                        {trade.profit !== null ? `$${trade.profit.toFixed(2)}` : "N/A"}
                                    </TableCell>
                                    <TableCell>
                                        {trade.profitPercentage !== null ? `${trade.profitPercentage.toFixed(2)}%` : "N/A"}
                                    </TableCell>
                                    <TableCell>{trade.holdingPeriod !== null ? trade.holdingPeriod : "N/A"}</TableCell>
                                    <TableCell>
                                        {trade.tradeCount !== undefined ? trade.tradeCount : (trade.trades ? trade.trades.length : "N/A")}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Container>
    );
}

export default SummaryPage;
