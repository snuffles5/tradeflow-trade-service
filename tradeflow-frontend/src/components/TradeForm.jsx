/*
src/components/TradeForm.jsx

This module defines the TradeForm component, which provides a user interface for submitting trade data.
Users can input details such as type, source, transaction type, ticker, quantity, price per unit, and custom date.
The component manages form state, validation, and submission to the backend API.
*/

import React, { useState, useEffect, useCallback } from "react";
import {
    Container,
    Box,
    Grid,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Checkbox,
    Button,
} from "@mui/material";

// Helper to get API URL
const API_URL = process.env.REACT_APP_API_URL || "";

function TradeForm() {
    // State for owners and sources
    const [owners, setOwners] = useState([]);
    const [sources, setSources] = useState([]); // sources will contain associated owners
    const [loadingOptions, setLoadingOptions] = useState(true);
    const [apiError, setApiError] = useState(null);

    // Form state - use IDs now
    const [formData, setFormData] = useState({
        tradeOwnerId: "", // Changed from type
        tradeSourceId: "", // Changed from source
        transactionType: "", // Keep Buy/Sell for now
        ticker: "",
        quantity: 1,
        pricePerUnit: "",
        useCustomDate: false,
        date: "",
    });

    // Fetch owners and sources on component mount
    useEffect(() => {
        Promise.all([
            fetch(`${API_URL}/api/trade-owners`).then(res => res.ok ? res.json() : Promise.reject(`Owners fetch failed: ${res.status}`)),
            fetch(`${API_URL}/api/trade-sources`).then(res => res.ok ? res.json() : Promise.reject(`Sources fetch failed: ${res.status}`))
        ])
        .then(([ownersData, sourcesData]) => {
            setOwners(ownersData || []); // Ensure array even if API returns null/undefined
            setSources(sourcesData || []); // Ensure array

            // Set initial form data based on fetched data
            const initialSource = sourcesData?.[0];
            const initialOwner = initialSource?.owners?.[0]; // First owner of the first source
            const firstTransactionType = "Buy"; // Default transaction type

            setFormData(prev => ({
                ...prev,
                tradeSourceId: initialSource?.id || "",
                tradeOwnerId: initialOwner?.id || "",
                transactionType: firstTransactionType,
            }));
            setLoadingOptions(false);
        })
        .catch((err) => {
            console.error("Error fetching form options:", err);
            setApiError(typeof err === 'string' ? err : "Could not load form options.");
            setLoadingOptions(false);
        });
    }, []); // Empty dependency array ensures this runs only once on mount

    // Get available owners for the currently selected source
    const availableOwners = useCallback(() => {
        if (!formData.tradeSourceId || sources.length === 0) {
            return [];
        }
        const selectedSource = sources.find(s => s.id === parseInt(formData.tradeSourceId, 10));
        return selectedSource?.owners || [];
    }, [formData.tradeSourceId, sources]);

    const handleChange = (e) => {
        const {name, value, type, checked} = e.target;
        const newValue = type === "checkbox" ? checked : value;

        setFormData((prev) => {
            const newState = {
                ...prev,
                [name]: newValue,
            };

            // If the source changed, reset the owner if the current owner is no longer valid
            if (name === 'tradeSourceId') {
                const newSource = sources.find(s => s.id === parseInt(newValue, 10));
                const currentOwnerIsValid = newSource?.owners?.some(o => o.id === prev.tradeOwnerId);
                if (!currentOwnerIsValid) {
                    // Set to the first available owner for the new source, or empty
                    newState.tradeOwnerId = newSource?.owners?.[0]?.id || "";
                }
            }
            return newState;
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Basic validation
        if (!formData.tradeSourceId) { alert("Source is required."); return; }
        if (!formData.tradeOwnerId) { alert("Owner is required."); return; }
        if (!formData.transactionType) { alert("Transaction Type is required."); return; }
        if (!formData.ticker.trim()) { alert("Ticker is required."); return; }
        if (!formData.pricePerUnit) { alert("Price per Unit is required."); return; }

        const dateToUse = formData.useCustomDate
            ? formData.date
            : new Date().toISOString().split("T")[0];

        const payload = {
            tradeOwnerId: parseInt(formData.tradeOwnerId, 10),
            tradeSourceId: parseInt(formData.tradeSourceId, 10),
            transactionType: formData.transactionType,
            ticker: formData.ticker.toUpperCase(),
            quantity: parseFloat(formData.quantity),
            pricePerUnit: parseFloat(formData.pricePerUnit),
            tradeDate: dateToUse,
        };

        console.log("Submitting payload to:", `${API_URL}/trades`, ", payload: ", payload);

        fetch(`${API_URL}/api/trades`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload),
        })
        .then((res) => res.json())
        .then((data) => {
            if (data.error) {
                alert("Error: " + data.error);
            } else {
                alert("Trade created, ID: " + data.tradeId);
                // Optionally reset form here
            }
        })
        .catch((err) => {
            console.error("Error submitting trade:", err);
            alert("An error occurred while submitting the trade.");
        });
    };

    // Render loading/error state or form
    if (loadingOptions) {
        return <Container maxWidth="sm"><Box sx={{ mt: 4, textAlign: 'center' }}>Loading form options...</Box></Container>;
    }
    if (apiError) {
         return <Container maxWidth="sm"><Box sx={{ mt: 4, textAlign: 'center', color: 'red' }}>Error: {apiError}</Box></Container>;
    }

    // Define Transaction Types locally or fetch if they become dynamic
    const transactionTypes = ["Buy", "Sell"];

    return (
        <Container maxWidth="sm">
            <Box sx={{mt: 4}}>
                <form onSubmit={handleSubmit}>
                    <Grid container spacing={2}>

                         {/* Source Select */}
                         <Grid item xs={12}>
                            <FormControl fullWidth required>
                                <InputLabel id="sourceLabel">Source</InputLabel>
                                <Select
                                    labelId="sourceLabel"
                                    id="tradeSourceId"      // ID matches state key
                                    name="tradeSourceId"     // Name matches state key
                                    value={formData.tradeSourceId} // Controlled component
                                    label="Source"
                                    onChange={handleChange}
                                >
                                    {sources.map((source) => (
                                        <MenuItem key={source.id} value={source.id}>{source.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Owner (Type) Select - Filtered by Source */}
                        <Grid item xs={12}>
                            <FormControl fullWidth required disabled={!formData.tradeSourceId}> {/* Disable if no source selected */}
                                <InputLabel id="ownerLabel">Owner</InputLabel>
                                <Select
                                    labelId="ownerLabel"
                                    id="tradeOwnerId"       // ID matches state key
                                    name="tradeOwnerId"      // Name matches state key
                                    value={formData.tradeOwnerId}  // Controlled component
                                    label="Owner"
                                    onChange={handleChange}
                                >
                                    {availableOwners().map((owner) => (
                                        <MenuItem key={owner.id} value={owner.id}>{owner.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Transaction Type Select */}
                        <Grid item xs={12}>
                            <FormControl fullWidth required>
                                <InputLabel id="transactionTypeLabel">Transaction Type</InputLabel>
                                <Select
                                    labelId="transactionTypeLabel"
                                    id="transactionType"
                                    name="transactionType"
                                    value={formData.transactionType}
                                    label="Transaction Type"
                                    onChange={handleChange}
                                >
                                     {transactionTypes.map((ttype) => (
                                        <MenuItem key={ttype} value={ttype}>{ttype}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Ticker */}
                        <Grid item xs={12}>
                            <TextField
                                label="Ticker"
                                name="ticker"
                                value={formData.ticker}
                                onChange={handleChange}
                                required
                                fullWidth
                            />
                        </Grid>

                        {/* Quantity */}
                        <Grid item xs={6}>
                            <TextField
                                label="Quantity"
                                name="quantity"
                                type="number"
                                inputProps={{step: "0.01"}}
                                value={formData.quantity}
                                onChange={handleChange}
                                required
                                fullWidth
                            />
                        </Grid>

                        {/* Price per Unit */}
                        <Grid item xs={6}>
                            <TextField
                                label="Price per Unit"
                                name="pricePerUnit"
                                type="number"
                                inputProps={{step: "0.01"}}
                                value={formData.pricePerUnit}
                                onChange={handleChange}
                                required
                                fullWidth
                            />
                        </Grid>

                        {/* Custom Date Checkbox */}
                        <Grid item xs={12}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        name="useCustomDate"
                                        checked={formData.useCustomDate}
                                        onChange={handleChange}
                                    />
                                }
                                label="Custom Date?"
                            />
                        </Grid>

                        {/* Date Picker */}
                        {formData.useCustomDate && (
                            <Grid item xs={12}>
                                <TextField
                                    label="Select Date"
                                    name="date"
                                    type="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    InputLabelProps={{shrink: true}}
                                    required={formData.useCustomDate}
                                    fullWidth
                                />
                            </Grid>
                        )}

                        {/* Submit Button */}
                        <Grid item xs={12}>
                            <Button variant="contained" type="submit" fullWidth>
                                Submit Action
                            </Button>
                        </Grid>
                    </Grid>
                </form>
            </Box>
        </Container>
    );
}

export default TradeForm;
