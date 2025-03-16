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
  Menu,
  MenuItem,
  IconButton,
  Snackbar,
  Alert,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";

function TradesList() {
  const [trades, setTrades] = useState([]);
  const [sortConfig, setSortConfig] = useState({key: "createdAt", direction: "desc"});
  const [search, setSearch] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [highlightSell, setHighlightSell] = useState(true);
  const [contextMenu, setContextMenu] = useState(null); // { mouseX, mouseY, trade }
  const [editingTrade, setEditingTrade] = useState(null); // trade object being edited
  const [snackbar, setSnackbar] = useState({open: false, message: "", severity: "success"});

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

  // Snackbar helper functions.
  const showSnackbar = (message, severity = "success") => {
    setSnackbar({open: true, message, severity});
  };

  const handleSnackbarClose = (event, reason) => {
    if (reason === "clickaway") return;
    setSnackbar({...snackbar, open: false});
  };

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/trades`)
        .then((res) => res.json())
        .then((data) => setTrades(data))
        .catch((err) => {
          console.error("Error fetching trades:", err);
          showSnackbar("Error fetching trades", "error");
        });
  }, []);

  // Sorting logic.
  const sortedTrades = useMemo(() => {
    return [...trades].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === "asc" ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [trades, sortConfig]);

  // Filtering logic.
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

  // Context menu handlers.
  const handleContextMenu = (event, trade) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      trade,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  // Copy row text.
  const handleCopy = () => {
    if (contextMenu && contextMenu.trade) {
      const {ticker, transactionType, quantity, pricePerUnit, tradeDate} = contextMenu.trade;
      const date = new Date(tradeDate).toLocaleDateString();
      const text = `${ticker} ${transactionType} ${quantity} * ${pricePerUnit}$ on ${date}`;
      navigator.clipboard.writeText(text);
      showSnackbar("Copied to clipboard!", "success");
    }
    handleCloseContextMenu();
  };

  // Start editing the selected trade.
  const handleEdit = () => {
    if (contextMenu && contextMenu.trade) {
      setEditingTrade(contextMenu.trade);
    }
    handleCloseContextMenu();
  };

  // Delete trade and update state.
  const handleDelete = () => {
    if (contextMenu && contextMenu.trade) {
      const tradeId = contextMenu.trade.id;
      fetch(`${process.env.REACT_APP_API_URL}/trades/${tradeId}`, {
        method: "DELETE",
      })
          .then((res) => {
            if (res.ok) {
              setTrades((prev) => prev.filter((t) => t.id !== tradeId));
              showSnackbar("Trade deleted successfully", "success");
            } else {
              showSnackbar("Failed to delete trade", "error");
            }
          })
          .catch((err) => {
            console.error("Error deleting trade:", err);
            showSnackbar("Error deleting trade", "error");
          });
    }
    handleCloseContextMenu();
  };

  // Handle changes in edit mode.
  const handleEditChange = (field, value) => {
    setEditingTrade((prev) => ({...prev, [field]: value}));
  };

  // Save updated trade.
  const handleSave = (tradeId) => {
    fetch(`${process.env.REACT_APP_API_URL}/trades/${tradeId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(editingTrade),
    })
        .then((res) => {
          if (!res.ok) {
            throw new Error("Update failed");
          }
          return res.json();
        })
        .then((data) => {
          setTrades((prev) =>
              prev.map((t) => (t.id === tradeId ? {...t, ...editingTrade} : t))
          );
          setEditingTrade(null);
          showSnackbar("Trade updated successfully", "success");
        })
        .catch((err) => {
          console.error("Error updating trade:", err);
          showSnackbar("Error updating trade", "error");
        });
  };

  // Cancel editing.
  const handleCancel = () => {
    setEditingTrade(null);
  };

  return (
      <Box sx={{backgroundColor: colors.outerBackground, minHeight: "100vh", p: 2}}>
        <Container maxWidth="lg" sx={{mt: 4, backgroundColor: colors.background, color: colors.text, p: 2}}>
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
                  {/* Extra column for actions when editing */}
                  <TableCell sx={{color: colors.text}}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTrades.map((trade) => {
                  const isEditing = editingTrade && editingTrade.id === trade.id;
                  // Highlight the row if the trade is a sell and highlighting is enabled.
                  const rowStyle =
                      highlightSell && trade.transactionType.toLowerCase() === "sell"
                          ? {backgroundColor: colors.highlight, "& td": {color: colors.text}}
                          : {"& td": {color: colors.text}};

                  return (
                      <TableRow
                          key={trade.id}
                          sx={rowStyle}
                          onContextMenu={(e) => handleContextMenu(e, trade)}
                      >
                        <TableCell>{trade.id}</TableCell>
                        <TableCell>
                          {isEditing ? (
                              <TextField
                                  value={editingTrade.tradeType}
                                  onChange={(e) => handleEditChange("tradeType", e.target.value)}
                                  size="small"
                              />
                          ) : (
                              trade.tradeType
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                              <TextField
                                  value={editingTrade.source}
                                  onChange={(e) => handleEditChange("source", e.target.value)}
                                  size="small"
                              />
                          ) : (
                              trade.source
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                              <TextField
                                  value={editingTrade.transactionType}
                                  onChange={(e) => handleEditChange("transactionType", e.target.value)}
                                  size="small"
                              />
                          ) : (
                              <span
                                  style={{
                                    color:
                                        trade.transactionType.toLowerCase() === "sell"
                                            ? colors.negative
                                            : colors.positive,
                                  }}
                              >
                          {trade.transactionType}
                        </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                              <TextField
                                  value={editingTrade.ticker}
                                  onChange={(e) => handleEditChange("ticker", e.target.value)}
                                  size="small"
                              />
                          ) : (
                              trade.ticker
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                              <TextField
                                  type="number"
                                  value={editingTrade.quantity}
                                  onChange={(e) => handleEditChange("quantity", parseFloat(e.target.value))}
                                  size="small"
                              />
                          ) : (
                              trade.quantity
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                              <TextField
                                  type="number"
                                  value={editingTrade.pricePerUnit}
                                  onChange={(e) => handleEditChange("pricePerUnit", parseFloat( e.target.value))}
                                  size="small"
                              />
                          ) : (
                              trade.pricePerUnit
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                              <TextField
                                  type="date"
                                  value={new Date(editingTrade.tradeDate).toISOString().split("T")[0]}
                                  onChange={(e) => handleEditChange("tradeDate", e.target.value)}
                                  size="small"
                              />
                          ) : (
                              new Date(trade.tradeDate).toLocaleDateString()
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing && (
                              <>
                                <IconButton onClick={() => handleSave(trade.id)} size="small">
                                  <SaveIcon/>
                                </IconButton>
                                <IconButton onClick={handleCancel} size="small">
                                  <CancelIcon/>
                                </IconButton>
                              </>
                          )}
                        </TableCell>
                      </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Context Menu */}
          <Menu
              open={contextMenu !== null}
              onClose={handleCloseContextMenu}
              anchorReference="anchorPosition"
              anchorPosition={
                contextMenu !== null
                    ? {top: contextMenu.mouseY, left: contextMenu.mouseX}
                    : undefined
              }
          >
            <MenuItem onClick={handleCopy}>Copy</MenuItem>
            <MenuItem onClick={handleEdit}>Edit</MenuItem>
            <MenuItem onClick={handleDelete}>Delete</MenuItem>
          </Menu>

          {/* Snackbar Notification */}
          <Snackbar
              open={snackbar.open}
              autoHideDuration={4000}
              onClose={handleSnackbarClose}
              anchorOrigin={{vertical: "bottom", horizontal: "center"}}
          >
            <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{width: "100%"}}>
              {snackbar.message}
            </Alert>
          </Snackbar>
        </Container>
      </Box>
  );
}

export default TradesList;
