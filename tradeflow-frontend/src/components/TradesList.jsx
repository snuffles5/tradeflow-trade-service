import React, { useEffect, useState } from "react";
import {
  Container,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableSortLabel,
  Paper,
  TextField,
  TableContainer,
} from "@mui/material";

function TradesList() {
  const [trades, setTrades] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: "created_at", direction: "desc" });
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/trades`)
      .then((res) => res.json())
      .then((data) => setTrades(data))
      .catch((err) => console.error("Error fetching trades:", err));
  }, []);

  // Sorting logic
  const sortedTrades = [...trades].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === "asc" ? -1 : 1;
    if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  // Filtering logic
const filteredTrades = sortedTrades.filter((trade) => {
  const searchTerms = search.toLowerCase().split(" ").filter(term => term); // Split search into words

  return searchTerms.every(term =>
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

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Trades List
      </Typography>

      {/* Search Filter */}
      <TextField
        label="Search by Ticker"
        variant="outlined"
        fullWidth
        sx={{ mb: 2 }}
        onChange={(e) => setSearch(e.target.value)}
      />

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {[
                { key: "id", label: "ID" },
                { key: "type", label: "Type" },
                { key: "source", label: "Source" },
                { key: "transaction_type", label: "Transaction Type" },
                { key: "ticker", label: "Ticker" },
                { key: "quantity", label: "Quantity" },
                { key: "price_per_unit", label: "Price per Unit" },
                { key: "stop_loss", label: "Stop Loss" },
                { key: "created_at", label: "Created At" },
              ].map(({ key, label }) => (
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
            {filteredTrades.map((trade) => (
              <TableRow key={trade.id}>
                <TableCell>{trade.id}</TableCell>
                <TableCell>{trade.type}</TableCell>
                <TableCell>{trade.source}</TableCell>
                <TableCell>{trade.transaction_type}</TableCell>
                <TableCell>{trade.ticker}</TableCell>
                <TableCell>{trade.quantity}</TableCell>
                <TableCell>{trade.price_per_unit}</TableCell>
                <TableCell>{trade.stop_loss}</TableCell>
                <TableCell>{new Date(trade.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}

export default TradesList;
