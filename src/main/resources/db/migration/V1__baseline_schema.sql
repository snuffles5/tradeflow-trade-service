CREATE TABLE trade_owners (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE trade_sources (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE source_owner_association (
    source_id BIGINT NOT NULL,
    owner_id BIGINT NOT NULL,
    PRIMARY KEY (source_id, owner_id),
    FOREIGN KEY (source_id) REFERENCES trade_sources(id),
    FOREIGN KEY (owner_id) REFERENCES trade_owners(id)
);

CREATE TABLE unrealized_holdings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ticker VARCHAR(255) NOT NULL,
    trade_owner_id BIGINT NOT NULL,
    trade_source_id BIGINT NOT NULL,
    net_quantity DECIMAL(19, 4) NOT NULL,
    average_cost DECIMAL(19, 4) NOT NULL,
    net_cost DECIMAL(19, 4) NOT NULL,
    latest_trade_price DECIMAL(19, 4) NOT NULL,
    open_date DATE NOT NULL,
    close_date DATE,
    stop_loss DECIMAL(19, 4),
    realized_pnl DECIMAL(19, 4),
    realized_pnl_percentage DECIMAL(19, 4),
    total_buy_quantity DECIMAL(19, 4) DEFAULT 0,
    total_buy_cost DECIMAL(19, 4) DEFAULT 0,
    total_sell_quantity DECIMAL(19, 4) DEFAULT 0,
    total_sell_value DECIMAL(19, 4) DEFAULT 0,
    deleted_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (trade_owner_id) REFERENCES trade_owners(id),
    FOREIGN KEY (trade_source_id) REFERENCES trade_sources(id),
    INDEX idx_unrealized_holdings_ticker (ticker),
    INDEX idx_unrealized_holdings_deleted_at (deleted_at)
);

CREATE TABLE trades (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transaction_type VARCHAR(50) NOT NULL,
    ticker VARCHAR(255) NOT NULL,
    quantity DECIMAL(19, 4) NOT NULL,
    price_per_unit DECIMAL(19, 4) NOT NULL,
    trade_date DATE NOT NULL,
    trade_owner_id BIGINT NOT NULL,
    trade_source_id BIGINT NOT NULL,
    holding_id BIGINT,
    deleted_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (trade_owner_id) REFERENCES trade_owners(id),
    FOREIGN KEY (trade_source_id) REFERENCES trade_sources(id),
    FOREIGN KEY (holding_id) REFERENCES unrealized_holdings(id),
    INDEX idx_trades_deleted_at (deleted_at)
);

CREATE TABLE last_price_info (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ticker VARCHAR(255) NOT NULL UNIQUE,
    last_price DECIMAL(19, 4),
    change_today DECIMAL(19, 4),
    change_today_percentage DECIMAL(19, 4),
    market_identifier VARCHAR(255),
    provider_source VARCHAR(255),
    last_updated TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
