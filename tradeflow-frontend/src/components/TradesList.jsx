/*
src/components/TradesList.jsx

This module renders the TradesList component which fetches and displays a list of trades in a table format.
It includes sorting and filtering capabilities to help users quickly search and analyze trade data.
*/

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
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });
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
      trade.tradeType.toLowerCase().includes(term)
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
                { key: "tradeType", label: "Type" },
                { key: "source", label: "Source" },
                { key: "transactionType", label: "Transaction Type" },
                { key: "ticker", label: "Ticker" },
                { key: "quantity", label: "Quantity" },
                { key: "pricePerUnit", label: "Price per Unit" },
                { key: "tradeDate", label: "Date" },
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
                <TableCell>{trade.tradeType}</TableCell>
                <TableCell>{trade.source}</TableCell>
                <TableCell>{trade.transactionType}</TableCell>
                <TableCell>{trade.ticker}</TableCell>
                <TableCell>{trade.quantity}</TableCell>
                <TableCell>{trade.pricePerUnit}</TableCell>
                <TableCell>{new Date(trade.tradeDate).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}

export default TradesList;
