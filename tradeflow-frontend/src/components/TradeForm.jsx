// src/components/TradeForm.jsx
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
        stopLoss: "",
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
            : new Date().toISOString().split("T")[0];

        if (!formData.ticker.trim()) {
            alert("Ticker is required.");
            return;
        }
        if (!formData.pricePerUnit) {
            alert("Price per Unit is required.");
            return;
        }

        const payload = {
            type: formData.type,
            source: formData.source,
            transactionType: formData.transactionType,
            ticker: formData.ticker,
            quantity: parseFloat(formData.quantity),
            pricePerUnit: parseFloat(formData.pricePerUnit),
            date: dateToUse,
            stopLoss: parseFloat(formData.stopLoss) || 0,
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
                    alert("Trade created, ID: " + data.trade_id);
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
                                <InputLabel id="type-label">Type</InputLabel>
                                <Select
                                    labelId="type-label"
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
                                <InputLabel id="source-label">Source</InputLabel>
                                <Select
                                    labelId="source-label"
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
                                <InputLabel id="transactionType-label">Transaction Type</InputLabel>
                                <Select
                                    labelId="transactionType-label"
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

                        {/* Stop Loss */}
                        <Grid item xs={12}>
                            <TextField
                                label="Stop Loss"
                                name="stopLoss"
                                type="number"
                                inputProps={{step: "0.01"}}
                                value={formData.stopLoss}
                                onChange={handleChange}
                                fullWidth
                            />
                        </Grid>

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
