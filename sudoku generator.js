function isSafe(board, row, col, num) {
  for (let x = 0; x <= 8; x++) {
    if (board[row][x] == num) {
      return false;
    }
  }

  for (let x = 0; x <= 8; x++) {
    if (board[x][col] == num) {
      return false;
    }
  }

  let startRow = row - (row % 3),
    startCol = col - (col % 3);

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (board[i + startRow][j + startCol] == num) {
        return false;
      }
    }
  }

  return true;
}

function solveSudoku(board, row = 0, col = 0) {
  if (row == 8 && col == 9) return true;

  if (col == 9) {
    row++;
    col = 0;
  }

  if (board[row][col] > 0) return solveSudoku(board, row, col + 1);

  let numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  numbers = numbers.sort(() => Math.random() - 0.5);
  console.log(numbers);
  for (let num of numbers) {
    if (isSafe(board, row, col, num)) {
      board[row][col] = num;
      if (solveSudoku(board, row, col + 1)) return true;
    }

    board[row][col] = 0;
  }
  return false;
}

function generateSudoku() {
  let board = Array.from({ length: 9 }, () => Array(9).fill(0));
  console.log(board);
  solveSudoku(board);
  return board;
}

let board = generateSudoku();
console.log(board);
