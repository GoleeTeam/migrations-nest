export interface IMigrationScript {
	run: () => Promise<void>;
}
