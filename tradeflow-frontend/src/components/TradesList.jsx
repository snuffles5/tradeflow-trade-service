import React, {useEffect, useState, useMemo} from "react";
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
  Checkbox,
  FormControlLabel,
  Box,
} from "@mui/material";

function TradesList() {
  const [trades, setTrades] = useState([]);
  const [sortConfig, setSortConfig] = useState({key: "createdAt", direction: "desc"});
  const [search, setSearch] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [highlightSell, setHighlightSell] = useState(true);

  // Define color scheme similar to Summary page.
  const colors = {
    text: darkMode ? "white" : "black",
    background: darkMode ? "#333" : "white",
    border: darkMode ? "white" : "black",
    positive: darkMode ? "#90ee90" : "green",
    negative: darkMode ? "#ff7f7f" : "red",
    highlight: darkMode ? "#675723" : "#fff5c5",
    outerBackground: darkMode ? "#222" : "inherit",
  };

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/trades`)
        .then((res) => res.json())
        .then((data) => setTrades(data))
        .catch((err) => console.error("Error fetching trades:", err));
  }, []);

  // Sorting logic.
  const sortedTrades = useMemo(() => {
    return [...trades].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === "asc" ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [trades, sortConfig]);

  // Filtering logic: split the search into words and ensure each term is present in the combined string.
  const filteredTrades = useMemo(() => {
    const searchTerms = search.toLowerCase().split(" ").filter(term => term);
    return sortedTrades.filter(trade => {
      const combined = `${trade.ticker} ${trade.source} ${trade.tradeType}`.toLowerCase();
      return searchTerms.every(term => combined.includes(term));
    });
  }, [sortedTrades, search]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  return (
      <Box sx={{backgroundColor: colors.outerBackground, minHeight: "100vh", p: 2}}>
        <Container
            maxWidth="md"
            sx={{mt: 4, backgroundColor: colors.background, color: colors.text, p: 2}}
        >
          <Typography variant="h4" gutterBottom>
            Trades List
          </Typography>

          {/* Search and Options */}
          <Box sx={{display: "flex", alignItems: "center", mb: 2, flexWrap: "wrap"}}>
            <TextField
                label="Search by Ticker, Source, or Type"
                variant="outlined"
                fullWidth
                sx={{
                  mb: 2,
                  input: {color: colors.text},
                  label: {color: colors.text},
                }}
                onChange={(e) => setSearch(e.target.value)}
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
                sx={{mr: 2, color: colors.text}}
            />
            <FormControlLabel
                control={
                  <Checkbox
                      checked={highlightSell}
                      onChange={(e) => setHighlightSell(e.target.checked)}
                      sx={{color: colors.text}}
                  />
                }
                label="Highlight Sell Trades"
                sx={{color: colors.text}}
            />
          </Box>

          <TableContainer component={Paper} sx={{backgroundColor: colors.background, color: colors.text}}>
            <Table>
              <TableHead>
                <TableRow>
                  {[
                    {key: "id", label: "ID"},
                    {key: "tradeType", label: "Trade Type"},
                    {key: "source", label: "Source"},
                    {key: "transactionType", label: "Transaction Type"},
                    {key: "ticker", label: "Ticker"},
                    {key: "quantity", label: "Quantity"},
                    {key: "pricePerUnit", label: "Price per Unit"},
                    {key: "tradeDate", label: "Date"},
                  ].map(({key, label}) => (
                      <TableCell key={key} sx={{color: colors.text}}>
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
                {filteredTrades.map((trade) => {
                  // Highlight the row if the trade is a sell and highlighting is enabled.
                  const rowStyle =
                      highlightSell && trade.transactionType.toLowerCase() === "sell"
                          ? {backgroundColor: colors.highlight, "& td": {color: colors.text}}
                          : {"& td": {color: colors.text}};

                  return (
                      <TableRow key={trade.id} sx={rowStyle}>
                        <TableCell>{trade.id}</TableCell>
                        <TableCell>{trade.tradeType}</TableCell>
                        <TableCell>{trade.source}</TableCell>
                        <TableCell>
                      <span
                          style={{
                            color: trade.transactionType.toLowerCase() === "sell" ? colors.negative : colors.positive,
                          }}
                      >
                        {trade.transactionType}
                      </span>
                        </TableCell>
                        <TableCell>{trade.ticker}</TableCell>
                        <TableCell>{trade.quantity}</TableCell>
                        <TableCell>{trade.pricePerUnit}</TableCell>
                        <TableCell>{new Date(trade.tradeDate).toLocaleDateString()}</TableCell>
                      </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Container>
      </Box>
  );
}

export default TradesList;
