import React, {useEffect, useState} from "react";
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
                    setSummaryData(prev => {
                        const newData = [...prev];
                        newData[index] = {...newData[index], updating: true};
                        return newData;
                    });

                    fetch(`${process.env.REACT_APP_API_URL}/last-price/${trade.ticker}`)
                        .then(res => res.json())
                        .then(data => {
                            // Compute updated profit and profitPercentage using the fresh lastPrice
                            const lastPrice = data.lastPrice;
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
                            setSummaryData(prev => {
                                const newData = [...prev];
                                newData[index] = {
                                    ...newData[index],
                                    currentPrice: lastPrice, // update currentPrice as well
                                    profit: updatedProfit,
                                    profitPercentage: updatedProfitPercentage,
                                    updating: false
                                };
                                return newData;
                            });
                        })
                        .catch(err => {
                            console.error(`Error fetching last price for ${trade.ticker}:`, err);
                            // On error, simply mark updating as false so N/A is shown.
                            setSummaryData(prev => {
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
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === "asc" ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
    });

    // Filter data based on search terms
    const filteredData = sortedData.filter((trade) => {
        const searchTerms = search.toLowerCase().split(" ").filter((term) => term);
        return searchTerms.every(
            (term) =>
                trade.ticker.toLowerCase().includes(term) ||
                trade.source.toLowerCase().includes(term) ||
                trade.type.toLowerCase().includes(term)
        );
    });

    // Pre-calculate totals from filtered data
    const totals = filteredData.reduce(
        (acc, trade) => {
            acc.totalQuantity += Number(trade.totalQuantity) || 0;
            acc.totalCost += Number(trade.totalCost) || 0;
            // For profit, if it's null then we add 0.
            acc.profit += trade.profit !== null ? Number(trade.profit) : 0;
            acc.tradeCount += Number(trade.tradeCount) || (trade.trades ? trade.trades.length : 0);
            return acc;
        },
        {totalQuantity: 0, totalCost: 0, profit: 0, tradeCount: 0}
    );

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
                                            <strong>{source}:</strong> Net Cash: ${formatNumber(data.totalNetCash)} |
                                            Profit %:{" "}
                                            {data.profitPercentage !== null ? `${formatNumber(data.profitPercentage)}%` : "N/A"}
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
                                            <strong>{type}:</strong> Net Cash: ${formatNumber(data.totalNetCash)} |
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
                                        {trade.totalQuantity === 0 ? "Closed" : Number(trade.totalQuantity).toLocaleString()}
                                    </TableCell>
                                    <TableCell>${formatNumber(trade.totalCost)}</TableCell>
                                    <TableCell>{trade.lastPrice ? `$${formatNumber(trade.lastPrice)}` : "N/A"}</TableCell>
                                    <TableCell>{trade.currentPrice ? `$${formatNumber(trade.currentPrice)}` : "N/A"}</TableCell>
                                    {/* Profit Column Cell */}
                                    <TableCell>
                                        {trade.updating ? (
                                            <CircularProgress size={16}/>
                                        ) : trade.profit !== null ? (
                                            <span style={{color: "black"}}>${formatNumber(trade.profit)}</span>
                                        ) : (
                                            <span style={{color: "lightgray"}}>N/A</span>
                                        )}
                                    </TableCell>

                                    {/* Profit Percentage Column Cell */}
                                    <TableCell>
                                        {trade.updating ? (
                                            <CircularProgress size={16}/>
                                        ) : trade.profitPercentage !== null ? (
                                            <span
                                                style={{color: "black"}}>{formatNumber(trade.profitPercentage)}%</span>
                                        ) : (
                                            <span style={{color: "lightgray"}}>N/A</span>
                                        )}
                                    </TableCell>

                                    <TableCell>{trade.holdingPeriod !== null ? trade.holdingPeriod : "N/A"}</TableCell>
                                    <TableCell>
                                        {trade.tradeCount !== undefined
                                            ? Number(trade.tradeCount).toLocaleString()
                                            : trade.trades
                                                ? trade.trades.length
                                                : "N/A"}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow
                                sx={{
                                    borderTop: "3px solid",
                                    borderColor: "divider",
                                }}
                            >
                                {/* Span the first three columns for a Totals label */}
                                <TableCell colSpan={3}>Totals</TableCell>
                                <TableCell>
                                    {totals.totalQuantity === 0
                                        ? "Closed"
                                        : Number(totals.totalQuantity).toLocaleString()}
                                </TableCell>
                                <TableCell>${formatNumber(totals.totalCost)}</TableCell>
                                <TableCell/>
                                <TableCell/>
                                <TableCell
                                    sx={{
                                        color: totals.profit >= 0 ? "green" : "red",
                                    }}
                                >
                                    ${formatNumber(totals.profit)}
                                </TableCell>
                                <TableCell/>
                                <TableCell/>
                                <TableCell>{Number(totals.tradeCount).toLocaleString()}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </TableContainer>
            )}
        </Container>
    );
}

export default SummaryPage;
