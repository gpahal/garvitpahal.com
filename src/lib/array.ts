export function* filter<T>(array: T[], predicate: (value: T, index: number) => boolean, limit?: number): Generator<T> {
  if (!limit || limit > array.length) {
    limit = array.length;
  }

  let count = 0;
  let i = 0;
  while (count < limit && i < array.length) {
    if (predicate(array[i], i)) {
      yield array[i];
      count++;
    }
    i++;
  }
}
