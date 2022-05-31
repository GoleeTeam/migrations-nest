import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";

export type MigrationVersionDocument = MigrationVersion & Document;

@Schema()
class MigrationVersion {
  _id: MongooseSchema.Types.ObjectId | string;

  @Prop({ type: Number, required: true, default: 0 })
  version: number;

  @Prop({ type: Boolean, default: false })
  lock: boolean;

  @Prop({ type: Boolean })
  last_run_completed: boolean;

  @Prop({ type: String })
  last_run_error: string;
}

const MigrationVersionSchema = SchemaFactory.createForClass(MigrationVersion);
export { MigrationVersion, MigrationVersionSchema };
