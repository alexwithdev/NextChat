import { JSONModifyRecorder } from '../app/utils/json-modify-recorder';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 测试用例
describe('JSONModifyRecorder', () => {
  it('Should initialize timestamps correctly', () => {
    const value = { a: 1, b: 2, c: { d: "4" } };
    const modifier = new JSONModifyRecorder(value);

    expect(modifier.getTimestamp('a')).toBeDefined();
    expect(modifier.getTimestamp('b')).toBeDefined();
    expect(modifier.getTimestamp('c')).toBeDefined();
    expect(modifier.getTimestamp('c.d')).toBeDefined();
  });

  it('Should only update the timestamp of modified keys', async () => {
    const value = { a: 1, b: 2, c: { d: "4" } };
    const modifier = new JSONModifyRecorder(value);
    const initialTime = modifier.getTimestamp('c.d')!;
    expect(initialTime).toBeDefined();

    // Add delay to ensure timestamps are different
    await sleep(1);
    modifier.update({ a: 1, b: 2, c: { d: "5" } });

    expect(modifier.getTimestamp('c')).toBeGreaterThan(initialTime);
    expect(modifier.getTimestamp('c.d')).toBeGreaterThan(initialTime);
  });

  it('Should handle key deletion', () => {
    const value = { a: 1, b: 2 };
    const modifier = new JSONModifyRecorder(value);
    modifier.update({ a: 1 });

    expect(modifier.getTimestampEntry('b')!.deleted).toBeTruthy();
    expect(modifier.getValue().b).toBeUndefined();
  });

  it('Should correctly merge modifications', async () => {
    const value1 = new JSONModifyRecorder({ a: 1 });
    await sleep(1);
    const value2 = new JSONModifyRecorder({ a: 2 });
    value1.merge(value2);
    expect(value1.getValue()).toEqual({ a: 2 });

    const value3 = new JSONModifyRecorder(3);
    await sleep(1);
    const value4 = new JSONModifyRecorder(4);
    value3.merge(value4);
    expect(value3.getValue()).toBe(4);

    const value5 = new JSONModifyRecorder([{ a: 1 }]);
    await sleep(1);
    const value6 = new JSONModifyRecorder([{ a: 2 }]);
    value5.merge(value6);
    expect(value5.getValue()).toEqual([{ a: 2 }]);
  });

  it('Should handle merging with deleted keys', async () => {
    const value1 = new JSONModifyRecorder({ a: 1, b: 2 });
    await sleep(1);
    const value2 = new JSONModifyRecorder({ a: 1, b: 2 });
    value2.update({ a: 1 }); // Simulate deletion of 'b'
    value1.merge(value2);

    expect(value1.getValue()).toEqual({ a: 1 });
    expect(value1.getTimestampEntry('b')!.deleted).toBeTruthy();
  });

  it('Should handle merging with nested objects', async () => {
    const value1 = new JSONModifyRecorder({ a: { b: 1 } });
    await sleep(1);
    const value2 = new JSONModifyRecorder({ a: { b: 2 } });
    value1.merge(value2);

    expect(value1.getValue()).toEqual({ a: { b: 2 } });
    expect(value1.getTimestamp('a.b')).toBeGreaterThan(value1.getTimestamp('a')!);
  });

  it('Should handle merging with arrays', async () => {
    const value1 = new JSONModifyRecorder([{ id: 1 }, { id: 2 }]);
    await sleep(1);
    const value2 = new JSONModifyRecorder([{ id: 1 }, { id: 3 }]);
    value1.merge(value2);

    expect(value1.getValue()).toEqual([{ id: 1 }, { id: 3 }]);
    expect(value1.getTimestamp('[1].id')).toBeGreaterThan(value1.getTimestamp('[0].id')!);
  });

  it('Should handle merging with primitive values', async () => {
    const value1 = new JSONModifyRecorder(1);
    await sleep(1);
    const value2 = new JSONModifyRecorder(2);
    value1.merge(value2);

    expect(value1.getValue()).toBe(2);
  });

  it('Should correctly serialize and deserialize', () => {
    const original = new JSONModifyRecorder({ a: 1 });
    const serialized = original.serialize();
    const restored = JSONModifyRecorder.deserialize(serialized);

    expect(restored.getValue()).toEqual({ a: 1 });
    expect(restored.getTimestamp('a')).toEqual(original.getTimestamp('a'));
  });

  it('Should handle array types', () => {
    const value = [{ id: 1 }, { id: 2 }];
    const modifier = new JSONModifyRecorder(value);
    expect(modifier.getTimestamp('[1].id')).toBeDefined();

    modifier.update([{ id: 1 }, { id: 3 }]);
    expect(modifier.getValue()).toEqual([{ id: 1 }, { id: 3 }]);
  });
});