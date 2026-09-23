export abstract class MigrationError extends Error {
    protected constructor(message: string) {
        super(message);
        this.name = new.target.name;
    }
}

export class DuplicateMigrationVersionsError extends MigrationError {
    constructor(versions: number[]) {
        super(`Duplicated Scripts for versions: ${versions}`);
    }
}

export class MissingMigrationVersionError extends MigrationError {
    constructor(scriptName: string) {
        super(`Migration Script: ${scriptName} must have a 'version' attribute!`);
    }
}

export class JobAlreadyRunningError extends MigrationError {
    constructor(jobName: string) {
        super(`Job "${jobName}" is already running`);
    }
}

export class JobNotFoundError extends MigrationError {
    constructor(jobName: string) {
        super(`Job "${jobName}" is not registered`);
    }
}

export class InvalidRequestedCountError extends MigrationError {
    constructor(requestedCount: number) {
        super(`requestedCount must be a positive integer, got: ${requestedCount}`);
    }
}
