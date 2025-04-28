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
    Select,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";

// Helper to get API URL
const API_URL = process.env.REACT_APP_API_URL || "";

function TradesList() {
    const [trades, setTrades] = useState([]);
    const [sortConfig, setSortConfig] = useState({key: "createdAt", direction: "desc"});
    const [search, setSearch] = useState("");
    const [darkMode, setDarkMode] = useState(false);
    const [highlightSell, setHighlightSell] = useState(true);
    const [contextMenu, setContextMenu] = useState(null); // { mouseX, mouseY, trade }
    const [editingTrade, setEditingTrade] = useState(null); // Stores the full trade object being edited
    const [snackbar, setSnackbar] = useState({open: false, message: "", severity: "success"});

    // State for owners and sources (needed for editing dropdowns)
    const [owners, setOwners] = useState([]);
    const [sources, setSources] = useState([]);
    const [loadingOptions, setLoadingOptions] = useState(true);

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

    // Fetch trades, owners, and sources
    useEffect(() => {
        Promise.all([
            fetch(`${API_URL}/trades`).then(res => res.ok ? res.json() : Promise.reject('Trades fetch failed')),
            fetch(`${API_URL}/trade-owners`).then(res => res.ok ? res.json() : Promise.reject('Owners fetch failed')),
            fetch(`${API_URL}/trade-sources`).then(res => res.ok ? res.json() : Promise.reject('Sources fetch failed')),
        ])
        .then(([tradesData, ownersData, sourcesData]) => {
            setTrades(tradesData || []);
            setOwners(ownersData || []);
            setSources(sourcesData || []);
            setLoadingOptions(false);
        })
        .catch(err => {
            console.error("Error fetching initial data:", err);
            showSnackbar(typeof err === 'string' ? err : "Error fetching data", "error");
            setLoadingOptions(false);
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

    // Filtering logic - update to use nested names
    const filteredTrades = useMemo(() => {
        const searchTerms = search.toLowerCase().split(" ").filter(term => term);
        return sortedTrades.filter(trade => {
            // Check if owner and source exist before accessing name
            const ownerName = trade.owner?.name || "";
            const sourceName = trade.source?.name || "";
            const combined = `${trade.ticker} ${sourceName} ${ownerName}`.toLowerCase();
            return searchTerms.every(term => combined.includes(term));
        });
    }, [sortedTrades, search]);

    const handleSort = (key) => {
        setSortConfig((prev) => ({
            key,
            direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
        }));
    };

    const handleRightClick = (event, trade) => {
        if (event.button !== 2) return; // Only act on right-click
        event.preventDefault();
        event.stopPropagation();
        // Toggle the context menu for the same trade
        if (contextMenu && contextMenu.trade?.id === trade.id) {
            setContextMenu(null);
        } else {
            setContextMenu({
                mouseX: event.clientX - 2,
                mouseY: event.clientY - 4,
                trade,
            });
        }
    };

    const handleCloseContextMenu = () => {
        setContextMenu(null);
    };

    useEffect(() => {
        const disableOSContextMenu = (event) => event.preventDefault();

        document.addEventListener("contextmenu", disableOSContextMenu);

        return () => {
            document.removeEventListener("contextmenu", disableOSContextMenu);
        };
    }, []);

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

    // Start editing - store the full trade object
    const handleEdit = () => {
        if (contextMenu && contextMenu.trade) {
            // Ensure the trade object has owner/source IDs for the initial edit state
            const tradeToEdit = {
                ...contextMenu.trade,
                tradeOwnerId: contextMenu.trade.owner?.id,
                tradeSourceId: contextMenu.trade.source?.id
            };
            setEditingTrade(tradeToEdit);
        }
        handleCloseContextMenu();
    };

    // Delete trade and update state.
    const handleDelete = () => {
        if (contextMenu && contextMenu.trade) {
            const tradeId = contextMenu.trade.id;
            fetch(`${API_URL}/trades/${tradeId}`, {
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
        setEditingTrade((prev) => {
            const newState = { ...prev, [field]: value };
            // Similar logic as TradeForm: if source changes, check/reset owner
            if (field === 'tradeSourceId') {
                const newSource = sources.find(s => s.id === parseInt(value, 10));
                const currentOwnerIsValid = newSource?.owners?.some(o => o.id === prev.tradeOwnerId);
                if (!currentOwnerIsValid) {
                    newState.tradeOwnerId = newSource?.owners?.[0]?.id || "";
                }
            }
            return newState;
        });
    };

    // Get available owners for the source selected in the *editing* trade
    const availableOwnersForEdit = useMemo(() => {
        if (!editingTrade?.tradeSourceId || sources.length === 0) {
            return [];
        }
        const selectedSource = sources.find(s => s.id === parseInt(editingTrade.tradeSourceId, 10));
        return selectedSource?.owners || [];
    }, [editingTrade?.tradeSourceId, sources]);

    // Save updated trade - send IDs
    const handleSave = (tradeId) => {
        // Construct payload with correct IDs and fields expected by backend
        const payload = {
            // Include all editable fields, ensure IDs are numbers
            ticker: editingTrade.ticker,
            transaction_type: editingTrade.transactionType,
            quantity: parseFloat(editingTrade.quantity) || 0,
            price_per_unit: parseFloat(editingTrade.pricePerUnit) || 0,
            trade_date: editingTrade.tradeDate, // Assuming YYYY-MM-DD format or similar
            trade_owner_id: parseInt(editingTrade.tradeOwnerId, 10),
            trade_source_id: parseInt(editingTrade.tradeSourceId, 10),
            // DO NOT send nested owner/source objects, only IDs
        };

        // Basic validation before sending
        if (!payload.trade_owner_id || !payload.trade_source_id) {
            showSnackbar("Owner and Source are required.", "error");
            return;
        }

        fetch(`${API_URL}/trades/${tradeId}`, {
            method: "PUT",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload),
        })
        .then(async (res) => {
            if (!res.ok) {
                 const errorData = await res.json().catch(() => ({})); // Try to get error message
                 throw new Error(errorData.error || `Update failed: ${res.status}`);
            }
            return res.json();
        })
        .then((data) => {
            // Update the local state with the data returned from the API
            // The API now returns the updated trade object nested under 'trade'
            const updatedTradeFromServer = data.trade; // Adjust if key is different
            if (!updatedTradeFromServer) {
                throw new Error("Invalid response from server after update.");
            }
            setTrades((prev) =>
                prev.map((t) => (t.id === tradeId ? updatedTradeFromServer : t))
            );
            setEditingTrade(null); // Exit edit mode
            showSnackbar("Trade updated successfully", "success");
        })
        .catch((err) => {
            console.error("Error updating trade:", err);
            showSnackbar(`Error updating trade: ${err.message}`, "error");
        });
    };

    // Cancel editing.
    const handleCancel = () => {
        setEditingTrade(null);
    };

    // Define table columns
    const columns = [
        {key: "id", label: "ID", sortable: true},
        {key: "ticker", label: "Ticker", sortable: true},
        // Updated to display nested names
        {key: "source", label: "Source", sortable: true, format: (trade) => trade.source?.name || "N/A"},
        {key: "owner", label: "Owner", sortable: true, format: (trade) => trade.owner?.name || "N/A"},
        {key: "transactionType", label: "Type", sortable: true},
        {key: "quantity", label: "Quantity", sortable: true},
        {key: "pricePerUnit", label: "Price", sortable: true, format: (trade) => `$${Number(trade.pricePerUnit).toFixed(2)}`},
        {key: "tradeDate", label: "Trade Date", sortable: true, format: (trade) => new Date(trade.tradeDate).toLocaleDateString()},
        {key: "createdAt", label: "Created At", sortable: true, format: (trade) => new Date(trade.createdAt).toLocaleString()},
        {key: "updatedAt", label: "Updated At", sortable: true, format: (trade) => new Date(trade.updatedAt).toLocaleString()},
        {key: "holdingId", label: "Holding ID", sortable: true},
    ];

    return (
        <Box sx={{backgroundColor: colors.outerBackground, minHeight: "100vh", p: 2}}>
            <Container maxWidth="lg" sx={{mt: 4, backgroundColor: colors.background, color: colors.text, p: 2}}>
                <Typography variant="h4" gutterBottom>
                    Trades List
                </Typography>

                {/* Search and Options */}
                <Box sx={{display: "flex", alignItems: "center", mb: 2, flexWrap: "wrap"}}>
                    <TextField
                        label="Search by Ticker, Source, or Owner"
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
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                {columns.map((col) => (
                                    <TableCell key={col.key} sx={{color: colors.text}}>
                                        {col.sortable ? (
                                            <TableSortLabel
                                                active={sortConfig.key === col.key}
                                                direction={sortConfig.key === col.key ? sortConfig.direction : "asc"}
                                                onClick={() => handleSort(col.key)}
                                            >
                                                {col.label}
                                            </TableSortLabel>
                                        ) : (
                                            col.label
                                        )}
                                    </TableCell>
                                ))}
                                <TableCell sx={{color: colors.text}}>Actions</TableCell> {/* Actions column for edit mode */}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredTrades.map((trade) => {
                                const isEditing = editingTrade?.id === trade.id;
                                return (
                                    <TableRow
                                        key={trade.id}
                                        hover
                                        onContextMenu={(e) => handleRightClick(e, trade)}
                                        sx={{
                                            cursor: "context-menu",
                                            backgroundColor: isEditing ? colors.highlight :
                                                (highlightSell && trade.transactionType === "Sell" ? colors.negative + '30' : undefined)
                                        }}
                                    >
                                        {columns.map((col) => (
                                            <TableCell key={col.key} sx={{color: colors.text}}>
                                                {isEditing ? (
                                                    // --- EDIT MODE INPUTS ---
                                                    col.key === 'owner' ? (
                                                        <Select
                                                            value={editingTrade.tradeOwnerId || ''}
                                                            onChange={(e) => handleEditChange('tradeOwnerId', e.target.value)}
                                                            size="small"
                                                            sx={{ minWidth: 100, backgroundColor: 'white' }} // Basic styling
                                                            disabled={!editingTrade.tradeSourceId || loadingOptions}
                                                        >
                                                            {availableOwnersForEdit.map(o => (
                                                                <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>
                                                            ))}
                                                        </Select>
                                                    ) : col.key === 'source' ? (
                                                          <Select
                                                            value={editingTrade.tradeSourceId || ''}
                                                            onChange={(e) => handleEditChange('tradeSourceId', e.target.value)}
                                                            size="small"
                                                            sx={{ minWidth: 100, backgroundColor: 'white' }}
                                                            disabled={loadingOptions}
                                                        >
                                                            {sources.map(s => (
                                                                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                                                            ))}
                                                        </Select>
                                                    ) : col.key === 'transactionType' ? (
                                                        <Select
                                                            value={editingTrade.transactionType || ''}
                                                            onChange={(e) => handleEditChange('transactionType', e.target.value)}
                                                            size="small"
                                                            sx={{ minWidth: 80, backgroundColor: 'white' }}
                                                        >
                                                            <MenuItem value="Buy">Buy</MenuItem>
                                                            <MenuItem value="Sell">Sell</MenuItem>
                                                        </Select>
                                                    ) : col.key === 'tradeDate' ? (
                                                        <TextField
                                                            type="date"
                                                            value={editingTrade[col.key]?.split('T')[0] || ''} // Format date
                                                            onChange={(e) => handleEditChange(col.key, e.target.value)}
                                                            size="small"
                                                        />
                                                    ) : [
                                                        'ticker',
                                                        'quantity',
                                                        'pricePerUnit'
                                                        // Add other editable fields here
                                                    ].includes(col.key) ? (
                                                        <TextField
                                                            value={editingTrade[col.key] || ''}
                                                            onChange={(e) => handleEditChange(col.key, e.target.value)}
                                                            size="small"
                                                            type={['quantity', 'pricePerUnit'].includes(col.key) ? 'number' : 'text'}
                                                        />
                                                    ) : (
                                                         // Non-editable fields in edit mode
                                                         col.format ? col.format(trade) : trade[col.key]
                                                    )
                                                ) : (
                                                    // --- DISPLAY MODE ---
                                                    col.format ? col.format(trade) : trade[col.key]
                                                )}
                                            </TableCell>
                                        ))}
                                        {/* Actions Cell */}
                                        <TableCell sx={{color: colors.text}}>
                                            {isEditing ? (
                                                <>
                                                    <IconButton size="small" onClick={() => handleSave(trade.id)}><SaveIcon/></IconButton>
                                                    <IconButton size="small" onClick={handleCancel}><CancelIcon/></IconButton>
                                                </>
                                            ) : null} {/* Can add view/details icon here later */}
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
                    anchorPosition={contextMenu ? {top: contextMenu.mouseY, left: contextMenu.mouseX} : undefined}
                >
                    <MenuItem onClick={handleCopy}>Copy Text</MenuItem>
                    <MenuItem onClick={handleEdit}>Edit</MenuItem>
                    <MenuItem onClick={handleDelete} sx={{color: 'red'}}>Delete</MenuItem>
                </Menu>

                 {/* Snackbar for notifications */}
                 <Snackbar
                    open={snackbar.open}
                    autoHideDuration={6000}
                    onClose={handleSnackbarClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                 >
                    <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
                        {snackbar.message}
                    </Alert>
                 </Snackbar>
            </Container>
        </Box>
    );
}

export default TradesList;
