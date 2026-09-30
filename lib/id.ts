import { customAlphabet, nanoid } from "nanoid";

/** Human-unfriendly but collision-safe internal id. */
export const newId = (prefix: string) => `${prefix}_${nanoid(10)}`;

/** Unambiguous alphabet for printed labels: no O/0, I/1, S/5, B/8. */
const labelAlphabet = "234679ACDEFGHJKLMNPQRTUVWXYZ";
const labelCode = customAlphabet(labelAlphabet, 6);

export const newLabelCode = () => labelCode();
