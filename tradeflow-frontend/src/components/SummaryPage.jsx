import React, { useEffect, useState } from "react";
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
} from "@mui/material";

function SummaryPage() {
  const [summaryData, setSummaryData] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: "totalQuantity", direction: "desc" });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/summary`)
        .then((res) => res.json())
        .then((data) => {
          setSummaryData(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching summary:", err);
          setLoading(false);
        });
  }, []);

  // Sorting logic
  const sortedData = [...summaryData].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === "asc" ? -1 : 1;
    if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  // Filtering logic based on search input
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
    { key: "ticker", label: "Ticker" },
    { key: "source", label: "Source" },
    { key: "type", label: "Type" },
    { key: "totalQuantity", label: "Total Quantity" },
    { key: "totalCost", label: "Total Cost" },
    { key: "lastPrice", label: "Last Trade Price" },
    { key: "currentPrice", label: "Current Price" },
    { key: "profit", label: "Profit" },
    { key: "profitPercentage", label: "Profit (%)" },
    { key: "holdingPeriod", label: "Holding Period (days)" },
    { key: "tradeCount", label: "Trade Count" },
  ];

  return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Trades Summary
        </Typography>

        {/* Search Filter */}
        <TextField
            label="Search by Ticker, Source, or Type"
            variant="outlined"
            fullWidth
            sx={{ mb: 2 }}
            onChange={(e) => setSearch(e.target.value)}
        />

        {loading ? (
            <CircularProgress />
        ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    {columns.map(({ key, label }) => (
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
                        <TableCell>{trade.totalQuantity}</TableCell>
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
