// IUnitOfWork
// Database-agnostic transactional boundary contract
// Defined according to M5.0 Work Package §2, §3, §4

export interface IUnitOfWork {
  /**
   * Executes an asynchronous operation inside an atomic transactional unit of work.
   * If the operation throws, any mutations performed within the unit of work MUST be rolled back.
   * Nested calls must participate in the transaction (e.g. via savepoints).
   */
  execute<T>(operation: () => Promise<T>): Promise<T>;
}
