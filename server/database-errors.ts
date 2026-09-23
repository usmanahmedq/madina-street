// Keep SQL parameters, connection strings and PostgreSQL row details out of logs.
export function logDatabaseError(stage: string, error: any) {
  console.error('Database failure', {
    stage, name: error?.name, code: error?.code,
    message: String(error?.message || 'Unknown storage error').replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted connection]'),
    table: error?.table, constraint: error?.constraint,
    cause: error?.cause?.code || error?.cause?.name,
  });
}

export async function acquireConnection<T>(connect: () => Promise<T>): Promise<T> {
  try { return await connect(); }
  catch (error: any) {
    const transient = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', '57P03'].includes(error?.code)
      || /connection (terminated|timeout)|timeout exceeded when trying to connect/i.test(error?.message || '');
    if (!transient) throw error;
    logDatabaseError('connection acquisition; retrying once before any transaction', error);
    return connect();
  }
}
