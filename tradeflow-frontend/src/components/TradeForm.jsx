/*
src/components/TradeForm.jsx

This module defines the TradeForm component, which provides a user interface for submitting trade data.
Users can input details such as type, source, transaction type, ticker, quantity, price per unit, and custom date.
The component manages form state, validation, and submission to the backend API.
*/

import React, {useState} from "react";
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

function TradeForm() {
    const [formData, setFormData] = useState({
        type: "Personal",
        source: "Interactive IL",
        transactionType: "Buy",
        ticker: "",
        quantity: 1,
        pricePerUnit: "",
        useCustomDate: false,
        date: "",
    });

    const handleChange = (e) => {
        const {name, value, type, checked} = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const dateToUse = formData.useCustomDate
            ? formData.date
            : new Date().toISOString().split("T")[0]; // "YYYY-MM-DD" format

        if (!formData.ticker.trim()) {
            alert("Ticker is required.");
            return;
        }
        if (!formData.pricePerUnit) {
            alert("Price per Unit is required.");
            return;
        }

        const payload = {
            tradeType: formData.type,
            source: formData.source,
            transactionType: formData.transactionType,
            ticker: formData.ticker.toUpperCase(),
            quantity: parseFloat(formData.quantity),
            pricePerUnit: parseFloat(formData.pricePerUnit),
            tradeDate: dateToUse,
        };

        console.log("Submitting payload to:", process.env.REACT_APP_API_URL, ", payload: ", payload);

        fetch(`${process.env.REACT_APP_API_URL}/trades`, {
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
                }
            })
            .catch((err) => {
                console.error("Error submitting trade:", err);
                alert("An error occurred while submitting the trade.");
            });
    };

    return (
        <Container maxWidth="sm">
            <Box sx={{mt: 4}}>
                <form onSubmit={handleSubmit}>
                    <Grid container spacing={2}>
                        {/* Type Select */}
                        <Grid item xs={12}>
                            <FormControl fullWidth required>
                                <InputLabel id="typeLabel">Type</InputLabel>
                                <Select
                                    labelId="typeLabel"
                                    id="type"
                                    name="type"
                                    value={formData.type}
                                    label="Type"
                                    onChange={handleChange}
                                >
                                    <MenuItem value="Personal">Personal</MenuItem>
                                    <MenuItem value="Joint">Joint</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Source Select */}
                        <Grid item xs={12}>
                            <FormControl fullWidth required>
                                <InputLabel id="sourceLabel">Source</InputLabel>
                                <Select
                                    labelId="sourceLabel"
                                    id="source"
                                    name="source"
                                    value={formData.source}
                                    label="Source"
                                    onChange={handleChange}
                                >
                                    <MenuItem value="Interactive IL">Interactive IL</MenuItem>
                                    <MenuItem value="One Zero">One Zero</MenuItem>
                                    <MenuItem value="Fibi">Fibi</MenuItem>
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
                                    <MenuItem value="Buy">Buy</MenuItem>
                                    <MenuItem value="Sell">Sell</MenuItem>
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
