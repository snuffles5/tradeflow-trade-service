// src/components/TradeForm.jsx
import React, {useState} from "react";

function TradeForm() {
    // Set default values for your form fields
    const [formData, setFormData] = useState({
        type: "Private",            // dropdown
        source: "Interactive IL",   // dropdown
        transactionType: "Buy",     // dropdown
        ticker: "",
        quantity: 1,
        pricePerUnit: "",
        useCustomDate: false,       // checkbox
        date: "",                   // only relevant if useCustomDate is true
        stopLoss: ""
    });

    // Handle changes for all inputs
    const handleChange = (e) => {
        const {name, value, type, checked} = e.target;

        // For checkbox, use `checked`; otherwise use `value`
        setFormData((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value
        }));
    };

    // Handle form submission
    const handleSubmit = (e) => {
        e.preventDefault();

        // If date is not checked, set date to today's date
        const dateToUse = formData.useCustomDate
            ? formData.date
            : new Date().toISOString().split("T")[0]; // "YYYY-MM-DD" format

        // Validate mandatory fields (except date):
        // - type, source, transactionType, ticker, quantity, pricePerUnit, stopLoss
        if (!formData.ticker.trim()) {
            alert("Ticker is required.");
            return;
        }
        if (!formData.pricePerUnit) {
            alert("Price per Unit is required.");
            return;
        }

        // Construct the final data to send to your backend
        const payload = {
            type: formData.type,
            source: formData.source,
            transactionType: formData.transactionType,
            ticker: formData.ticker,
            quantity: parseFloat(formData.quantity),
            pricePerUnit: parseFloat(formData.pricePerUnit),
            date: dateToUse,
            stopLoss: parseFloat(formData.stopLoss)
        };

        // Log the payload for debugging
        console.log("Submitting payload:", payload);

        // Update the fetch URL to your Elastic Beanstalk URL
        fetch("https://<YOUR_EB_URL>/api/trades", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload)
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
        <div style={{maxWidth: "400px", margin: "0 auto"}}>
            <h2>Enter Trade Action</h2>
            <form onSubmit={handleSubmit}>
                {/* Type */}
                <label>
                    Type:
                    <select
                        name="type"
                        value={formData.type}
                        onChange={handleChange}
                        required
                    >
                        <option value="Private">Private</option>
                        <option value="Joint">Joint</option>
                    </select>
                </label>
                <br/>

                {/* Source */}
                <label>
                    Source:
                    <select
                        name="source"
                        value={formData.source}
                        onChange={handleChange}
                        required
                    >
                        <option value="Interactive IL">Interactive IL</option>
                        <option value="One Zero">One Zero</option>
                        <option value="Fibi">Fibi</option>
                    </select>
                </label>
                <br/>

                {/* Transaction Type */}
                <label>
                    Transaction Type:
                    <select
                        name="transactionType"
                        value={formData.transactionType}
                        onChange={handleChange}
                        required
                    >
                        <option value="Buy">Buy</option>
                        <option value="Sell">Sell</option>
                    </select>
                </label>
                <br/>

                {/* Ticker */}
                <label>
                    Ticker:
                    <input
                        type="text"
                        name="ticker"
                        value={formData.ticker}
                        onChange={handleChange}
                        required
                    />
                </label>
                <br/>

                {/* Quantity */}
                <label>
                    Quantity:
                    <input
                        type="number"
                        step="0.01"
                        name="quantity"
                        value={formData.quantity}
                        onChange={handleChange}
                        required
                    />
                </label>
                <br/>

                {/* Price per Unit */}
                <label>
                    Price per Unit:
                    <input
                        type="number"
                        step="0.01"
                        name="pricePerUnit"
                        value={formData.pricePerUnit}
                        onChange={handleChange}
                        required
                    />
                </label>
                <br/>

                {/* Custom Date checkbox */}
                <label>
                    <input
                        type="checkbox"
                        name="useCustomDate"
                        checked={formData.useCustomDate}
                        onChange={handleChange}
                    />
                    Custom Date?
                </label>
                <br/>

                {/* If custom date is selected, show date input */}
                {formData.useCustomDate && (
                    <label>
                        Select Date:
                        <input
                            type="date"
                            name="date"
                            value={formData.date}
                            onChange={handleChange}
                            required={formData.useCustomDate}
                        />
                    </label>
                )}
                <br/>

                {/* Stop Loss */}
                <label>
                    Stop Loss:
                    <input
                        type="number"
                        step="0.01"
                        name="stopLoss"
                        value={formData.stopLoss}
                        onChange={handleChange}
                    />
                </label>
                <br/>

                <button type="submit">Submit Action</button>
            </form>
        </div>
    );
}

export default TradeForm;
