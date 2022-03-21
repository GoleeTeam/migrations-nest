import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type MigrationVersionDocument = MigrationVersion & Document;

@Schema()
class MigrationVersion {
	_id: MongooseSchema.Types.ObjectId | string;

	@Prop({ type: Number, required: true, default: 0 })
	version: number;

	@Prop({ type: Boolean, default: false })
	lock: boolean;
}

const MigrationVersionSchema = SchemaFactory.createForClass(MigrationVersion);
export { MigrationVersion, MigrationVersionSchema };
