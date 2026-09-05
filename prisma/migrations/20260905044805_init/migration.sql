-- CreateTable
CREATE TABLE `clients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `client_id` VARCHAR(64) NOT NULL,
    `client_secret_hash` VARCHAR(191) NOT NULL,
    `scopes` VARCHAR(1000) NOT NULL DEFAULT '',
    `current_refresh_jti` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `clients_client_id_key`(`client_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `request_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `method` VARCHAR(10) NOT NULL,
    `url` VARCHAR(255) NOT NULL,
    `status_code` INTEGER NOT NULL,
    `message` TEXT NULL,
    `client_id` INTEGER NULL,
    `ip` VARCHAR(45) NULL,
    `response_time_ms` DOUBLE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `request_logs_client_id_idx`(`client_id`),
    INDEX `request_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
