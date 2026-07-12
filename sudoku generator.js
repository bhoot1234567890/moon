/* ============================================================
 * Sudoku puzzle generator — chaitanyamalhotra.com
 * ------------------------------------------------------------
 * Produces a fully-solved random 9x9 board via backtracking that
 * tries candidate digits in an UNBIASED Fisher-Yates order, then
 * carves a playable puzzle by removing clues.
 *
 * It is a classic (non-module) script wrapped in an IIFE so that it
 * (a) never auto-executes on load and (b) does not collide with the
 * solver functions already defined inline in sudoku.html. It exposes
 * a single global: window.SudokuGenerator.
 *
 * Previous issues fixed (P4.7):
 *   - Replaced biased `arr.sort(() => Math.random() - 0.5)` with a
 *     proper Fisher-Yates (Knuth) shuffle.
 *   - Removed per-recursive-call `console.log` spam.
 *   - Removed top-level auto-run that logged on import.
 * ============================================================ */
(function (global) {
  "use strict";

  /**
   * Fisher-Yates (Knuth) shuffle — unbiased, in-place, O(n).
   * Each of the n! permutations is equally likely.
   */
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  // True if `num` may legally occupy board[row][col].
  function isSafe(board, row, col, num) {
    for (var x = 0; x <= 8; x++) {
      if (board[row][x] === num) return false;
      if (board[x][col] === num) return false;
    }
    var startRow = row - (row % 3);
    var startCol = col - (col % 3);
    for (var i = 0; i < 3; i++) {
      for (var j = 0; j < 3; j++) {
        if (board[i + startRow][j + startCol] === num) return false;
      }
    }
    return true;
  }

  // Randomized backtracking solver. Fills an empty board with a complete,
  // valid solution whose digit order is non-deterministic each call.
  function solve(board, row, col) {
    if (row === 8 && col === 9) return true;
    if (col === 9) {
      row++;
      col = 0;
    }
    if (board[row][col] > 0) return solve(board, row, col + 1);

    var numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (var k = 0; k < numbers.length; k++) {
      var num = numbers[k];
      if (isSafe(board, row, col, num)) {
        board[row][col] = num;
        if (solve(board, row, col + 1)) return true;
        board[row][col] = 0;
      }
    }
    return false;
  }

  /**
   * Generate a complete, valid, randomly-ordered solved 9x9 board.
   * @returns {number[][]} 9x9 array of digits 1-9.
   */
  function generateSudoku() {
    var board = [];
    for (var i = 0; i < 9; i++) board.push([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    solve(board, 0, 0);
    return board;
  }

  /**
   * Generate a playable puzzle: a solved board with `holes` cells removed.
   * The remaining clues are solvable by the page's deterministic
   * backtracking solver. A minimum-valid Sudoku needs >= 17 clues, so the
   * hole count is clamped to leave at least that many.
   * @param {number} [holes=40] cells to remove (≈ easy/medium difficulty).
   * @returns {number[][]} 9x9 array; 0 marks an empty cell.
   */
  function generatePuzzle(holes) {
    if (typeof holes !== "number" || isNaN(holes) || holes < 0) holes = 40;
    if (holes > 64) holes = 64; // 81 - 64 = 17 clue floor
    var board = generateSudoku();
    var positions = [];
    for (var r = 0; r < 9; r++) {
      for (var c = 0; c < 9; c++) positions.push([r, c]);
    }
    shuffle(positions);
    for (var i = 0; i < holes; i++) {
      var pos = positions[i];
      board[pos[0]][pos[1]] = 0;
    }
    return board;
  }

  global.SudokuGenerator = {
    shuffle: shuffle,
    generateSudoku: generateSudoku,
    generatePuzzle: generatePuzzle,
  };
})(typeof window !== "undefined" ? window : this);
