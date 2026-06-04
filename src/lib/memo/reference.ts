export function generateReferenceNumber(year: number, sequence: number): string {
  return `RPS/EMEMO/${year}/${String(sequence).padStart(4, '0')}`;
}

export async function getNextSequence(
  supabase: { rpc: (fn: string) => Promise<{ data: string | null; error: unknown }> }
): Promise<string> {
  const { data, error } = await supabase.rpc('generate_memo_reference');
  if (error) throw error;
  if (data) return data;

  // Fallback if RPC not available
  const year = new Date().getFullYear();
  return generateReferenceNumber(year, 1);
}
