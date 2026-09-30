import { describe, expect, it } from "vitest";
import { pickWinner } from "@/lib/domain/winner";

describe("pickWinner", () => {
  it("devuelve null si no hay boletos vendidos", () => {
    expect(pickWinner([], () => 0)).toBeNull();
  });

  it("elige el número correspondiente al índice devuelto por randomInt", () => {
    const sold = [3, 7, 15, 42];
    expect(pickWinner(sold, () => 0)).toBe(3);
    expect(pickWinner(sold, () => 3)).toBe(42);
  });

  it("pasa el tamaño del arreglo como límite exclusivo a randomInt", () => {
    const sold = [10, 20, 30];
    let receivedMax = -1;
    pickWinner(sold, (max) => {
      receivedMax = max;
      return 0;
    });
    expect(receivedMax).toBe(sold.length);
  });

  it("siempre elige un número que efectivamente fue vendido", () => {
    const sold = [1, 2, 3, 4, 5];
    for (let i = 0; i < sold.length; i++) {
      expect(sold).toContain(pickWinner(sold, () => i));
    }
  });
});
