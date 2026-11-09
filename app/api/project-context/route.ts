import { getProjectContext } from "@/lib/projects/context";

export function GET() {
  return Response.json(getProjectContext());
}
