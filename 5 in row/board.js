;
'use strict';

  (() => {
    var App = this;
      this.model = new AppModel();
      this.view = new AppView(this.model);
      this.controller = new AppCtrl(this.model, this.view);
})();


function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// BEGIN MODEL
function AppModel() {
  let AppModel = this;

  this.board = [];
  this.board_size = 15;
  this.row;
  this.col;
  this.line = [];
  this.hashStep;
  this.step = 0;
  this.figure = true;
  this.playing = true;
  this.player1 = 0;
  this.player2 = 0;
  this.playerCPU = 0;
  this.cpuMode = true;
  this.directions = [];
  this.freeCells = this.board_size * this.board_size;
  for (var i = 0; i < this.board_size; i++) {
    this.board[i] = [];
    for(var j=0; j < this.board_size; j++)
      this.board[i].push(0);
  }
  this.patternWin = [0, /(1){5}/, /(2){5}/, /[01]*7[01]*/, /[02]*7[02]*/];
  this.pattern = [[], [], []];
  this.prePattern = [
    {s: 'xxxxx', w: 99},
    {s: '0xxxx0', w: 88},
    {s: '0xxxx', w: 77},
    {s: 'xxxx0', w: 77},
    {s: '0x0xxx', w: 66},
    {s: '0xx0xx', w: 66},
    {s: '0xxx0x', w: 66},
    {s: 'xxx0x0', w: 66},
    {s: 'xx0xx0', w: 66},
    {s: 'x0xxx0', w: 66},
    {s: '0xxx0', w: 55},
    {s: '0xxx', w: 44},
    {s: 'xxx0', w: 44},
    {s: '0xx0x', w: 33},
    {s: '0x0xx', w: 33},
    {s: 'xx0x0', w: 33},
    {s: 'x0xx0', w: 33},
    {s: '0xx0', w: 22}
  ];

  this.init = () =>{
    let s;
    let a;
    let l;
    let target = 'x';
    let pos;
    for (var i in this.prePattern) // Заполнение массива шаблонов построений фигур для крестиков (1) и ноликов (2)
    {
        s = this.prePattern[i].s;
        pos = -1;
        a = [];
        while ((pos = s.indexOf(target, pos + 1)) !== -1) {
            a[a.length] = s.substr(0, pos) + '7' + s.substr(pos + 1);
        }
        s = a.join('|');
        l = this.pattern[0].length;
        this.pattern[0][l] = this.prePattern[i].w;              // Веса шаблонов
        this.pattern[1][l] = new RegExp(s.replace(/x/g, '1'));  // Шаблоны для Х, например 01110 - открытая четверка
        this.pattern[2][l] = new RegExp(s.replace(/x/g, '2'));  // Аналогично для 0 - 022220
    }
    for (var row = -2; row <= 2; row++) // Заполнение массива потенциальных ходов (в радиусе 2 клеток)
    {                             // и установка минимальных весов (используются для расчета первых ходов, пока не появятся шаблоны)
        for (var col = -2; col <= 2; col++)
        {
            if (row === 0 && col === 0)
                continue;
            if (Math.abs(row) <= 1 && Math.abs(col) <= 1)
                this.directions.push({row: row, col: col, w: 3});
            else if (Math.abs(row) === Math.abs(col) || row * col === 0)
                this.directions.push({row: row, col: col, w: 2});
            else
                this.directions.push({row: row, col: col, w: 1});
        }
    }
  };

  this.switchGame = a => {
    if(a === 1)
      this.cpuMode = true;
    else
      this.cpuMode = false;
  };

  this.setStartData = a => { // Начальные установки для каждой новой игры
    this.figure = true;
    this.board = [];
    this.line = [];
    this.hashStep = {7: {7: {sum: 0, attack: 1, defence: 0, attackPattern: 0, defencePattern: 0}}}; // первый шаг, если АИ играет за Х
    this.freeCells = this.board_size * this.board_size;
    for (var r = 0; r < this.board_size; r++) {
      this.board[r] = [];
      for (var c = 0; c < this.board_size; c++)
        this.board[r][c] = 0;
    }
    this.step = 0;
    this.playing = true;
  };

    this.setRC = a => { // Установка координат текущего хода
      this.row = a.row;
      this.col = a.col;
    };

    this.emptyCell = () => { // Проверка ячейки на доступность для хода
      return this.board[this.row][this.col] === 0;
    };

    this.moveUser = () => { // Ход пользователя
      this.playing = false;    // Запрещаем кликать, пока идет расчет
      return this.move(this.row, this.col, false);
    };

    this.moveAI = () => { // Ход АИ
        this.playing = false;
        let row, col;
        let max = 0;
        this.calculateHashMovePattern(); // Расчет весов по заданным шаблонам ходов
        for (row in this.hashStep)         // Поиск веса лучшего хода
            for (col in this.hashStep[row])
                if (this.hashStep[row][col].sum > max)
                    max = this.hashStep[row][col].sum;
        var goodmoves = [];
        for (row in this.hashStep)         // Поиск лучших ходов (если их несколько)
            for (col in this.hashStep[row])
                if (this.hashStep[row][col].sum === max) {
                    goodmoves[goodmoves.length] = {row: parseInt(row), col: parseInt(col)};
                }
        var movenow = goodmoves[getRandomInt(0, goodmoves.length - 1)]; // Выбор хода случайным образом, если несколько ходов на выбор
        this.row = movenow.row;
        this.col = movenow.col;
        return this.move(this.row, this.col, true);
    };

    this.move = (row, col, aiStep) => { // Ход (АИ или пользователя)
        if (this.hashStep[row] && this.hashStep[row][col])
            delete this.hashStep[row][col];  // Если поле хода было в массиве потенциальных ходов, то поле удаляется из него
        this.board[row][col] = 2 - this.figure; // Сохранение хода в матрице полей игры
        this.figure = !this.figure; // Переход хода от Х к О, от О к Х
        this.freeCells--;
        var t = this.board[this.row][this.col]; // Далее идет проверка на выигрыш в результате этого хода: поиск 5 в ряд по 4 направлениям | — / \
        var s = ['', '', '', ''];
        var nT = Math.min(this.row, 4);
        var nR = Math.min(this.board_size - this.col - 1, 4);
        var nB = Math.min(this.board_size - this.row - 1, 4);
        var nL = Math.min(this.col, 4);
        for (var j = this.row - nT; j <= this.row + nB; j++)
            s[0] += this.board[j][this.col];
        for (var i = this.col - nL; i <= this.col + nR; i++)
            s[1] += this.board[this.row][i];
        for (var i = -Math.min(nT, nL); i <= Math.min(nR, nB); i++)
            s[2] += this.board[this.row + i][this.col + i];
        for (var i = -Math.min(nB, nL); i <= Math.min(nR, nT); i++)
            s[3] += this.board[this.row - i][this.col + i];
        var k;
        if ((k = s[0].search(this.patternWin[t])) >= 0)
            this.line = [this.col, this.row - nT + k, this.col, this.row - nT + k + 4];
        else if ((k = s[1].search(this.patternWin[t])) >= 0)
            this.line = [this.col - nL + k, this.row, this.col - nL + k + 4, this.row];
        else if ((k = s[2].search(this.patternWin[t])) >= 0)
            this.line = [this.col - Math.min(nT, nL) + k, this.row - Math.min(nT, nL) + k, this.col - Math.min(nT, nL) + k + 4, this.row - Math.min(nT, nL) + k + 4];
        else if ((k = s[3].search(this.patternWin[t])) >= 0)
            this.line = [this.col - Math.min(nB, nL) + k, this.row + Math.min(nB, nL) - k, this.col - Math.min(nB, nL) + k + 4, this.row + Math.min(nB, nL) - k - 4, -1];
        this.playing = (this.freeCells !== 0 && this.line.length === 0); // Проверка на окончание игры (победа или нет свободных ячеек)
        if(this.line.length !== 0){
          if(this.step%2 === 0){
            this.player1++;
          } else if(this.cpuMode){
            this.playerCPU++;
          } else{
            this.player2++;
          }
        }
        if (this.playing)
            this.calculateHashMove(aiStep); // Рассчитываем веса потенциальных ходов (без шаблонов)
        ++this.step + ': ' + row + ', ' + col;
        return {row: row, col: col};
    };

    this.calculateHashMove = (attack) => { // Расчет весов потенциальных ходов (без шаблонов), просто по количеству Х и О рядом (акуально в начале игры)
      for (let key in this.directions) {
        let row = this.row + this.directions[key].row;
        let col = this.col + this.directions[key].col;
        if (row < 0 || col < 0 || row >= this.board_size || col >= this.board_size)
          continue;
        if (this.board[row][col] !== 0)
          continue;
        if (!(row in this.hashStep))
          this.hashStep[row] = {};
        if (!(col in this.hashStep[row]))
          this.hashStep[row][col] = {sum: 0, attack: 0, defence: 0, attackPattern: 0, defencePattern: 0};
        if (attack)
          this.hashStep[row][col].attack += this.directions[key].w;
        else
          this.hashStep[row][col].defence += this.directions[key].w;
      }
    };

    this.calculateHashMovePattern = () => { // Расчет весов потенциальных ходов по заданным шаблонам
        let s;
        let k = 0;
        let attack = 2 - this.figure;
        let defence = 2 - !this.figure;
        let res;
        for (row in this.hashStep)
            for (col in this.hashStep[row]) // Перебор всех потенциальных ходов (*1)
            {
                this.hashStep[row][col].sum = this.hashStep[row][col].attack + this.hashStep[row][col].defence;
                this.hashStep[row][col].attackPattern = 0; // Обнуляем значение атаки по шаблону
                this.hashStep[row][col].defencePattern = 0; // Обнуляем значение защиты по шаблону
                row = parseInt(row);
                col = parseInt(col);
                for (var q = 1; q <= 2; q++) // Первым проходом расчитываем веса атаки, вторым - веса защиты
                    for (var j = 1; j <= 4; j++)
                    {
                      s = '';
                      for (var i = -4; i <= 4; i++) // Циклы перебора в радиусе 4 клеток от рассматриваемого хода (выбраннного в *1)
                        switch (j) { // Создание строк с текущим состоянием клеток по 4 направлениям, такого вида 000172222
                          case 1:  // где 7 - это рассматриваемый ход, 0 - свободная ячейка, 1 - крестик, 2 - нолик
                            if (row + i >= 0 && row + i < this.board_size)
                              s += (i === 0) ? '7' : this.board[row + i][col];
                            break;
                          case 2:
                            if (col + i >= 0 && col + i < this.board_size)
                              s += (i === 0) ? '7' : this.board[row][col + i];
                            break;
                          case 3:
                            if (row + i >= 0 && row + i < this.board_size)
                              if (col + i >= 0 && col + i < this.board_size)
                                s += (i === 0) ? '7' : this.board[row + i][col + i];
                            break;
                          case 4:
                            if (row - i >= 0 && row - i < this.board_size)
                              if (col + i >= 0 && col + i < this.board_size)
                                s += (i === 0) ? '7' : this.board[row- i][col + i];
                            break;
                          }
                        res = (q === 1) ? this.patternWin[2 + attack].exec(s) : this.patternWin[2 + defence].exec(s);
                        if (res === null)
                          continue;
                        if (res[0].length < 5) // Если длина возможной линии <5, то построить 5 не удастся в принципе и расчет можно не производить
                          continue;          // например, при восходящей диагонали для ячейки (0, 0) или (0, 1) или если с 2х сторон зажал соперник
                        if (q === 1) // для крестиков, если играем крестиками и наоборот. Формируем вес атаки на этом поле
                          for (var i in this.pattern[attack]) { // перебор по всем шаблонам
                            if (this.pattern[attack][i].test(s)) // если нашли соответствие
                              this.hashStep[row][col].attackPattern += this.pattern[0][i]; // увеличиваем значимость клетки на вес шаблона
                            }
                        else // для ноликов если играем крестиками
                          for (var i in this.pattern[defence])
                            if (this.pattern[defence][i].test(s))
                                this.hashStep[row][col].defencePattern += this.pattern[0][i];
                    }
                this.hashStep[row][col].sum += 1.1 * this.hashStep[row][col].attackPattern + this.hashStep[row][col].defencePattern; // Атака на 10% важнее защиты
                k++;
            }
    };
    this.init();
}
// END MODEL


// BEGIN VIEW
function AppView(model) {
  let AppView = this;
  this.model = model;
  this.canvas;
  this.scoreboard;
  this.ctx;
  this.cts;
  this.gameMode;
  this.cellSize = 30;
  this.halfCellSize = this.cellSize / 2;
  this.radius = this.cellSize / 3;
  this.width = 4;
  this.color = {canvasStroke: '#2c3e50', canvasFill: '#34495e', zero: '#e74c3c', cross: '#2ecc71', line: '#FFCC71',
      black: '#000', scoreboard: '#3d3d3d'};

  this.init = () => {
    this.scoreboard = this.getCanvas('scoreboard');
    this.canvas = this.getCanvas('gameboard');
    this.ctx = this.canvas.getContext('2d');
  };

  this.getCanvas = id => {
   let canvas = document.getElementById(id);
    canvas.width = this.cellSize * this.model.board_size;
    if(id === 'gameboard')
      canvas.height = this.cellSize * this.model.board_size;
    return canvas;
  };

  this.renderScoreboard = () => {
    this.cts = this.scoreboard.getContext('2d');
    let ctx = this.cts;
    ctx.fillStyle = this.color.scoreboard;
    ctx.fillRect(0, 0, this.scoreboard.width, this.cellSize * 3 );
    this.renderButton(this.color.cross, 'VS', [0, 90]);
    this.renderButton(this.color.zero, 'CPU', [this.scoreboard.width - 90, 90]);
    this.renderScore();
  };

  this.renderBoard = () => {
    let ctx = this.ctx;
    let cellSize = this.cellSize;
    ctx.strokeStyle = this.color.canvasStroke;
    ctx.fillStyle = this.color.canvasFill;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    for (var i=1; i < this.model.board_size; i++){
        ctx.beginPath();
        ctx.moveTo( 0, i * cellSize );
        ctx.lineTo( cellSize * this.model.board_size, i * cellSize );
        ctx.moveTo( i * cellSize, 0 );
        ctx.lineTo( i * cellSize, cellSize * this.model.board_size );
        ctx.closePath();
        ctx.stroke();
    }
  };

  this.renderZero = (row, col) => {
    let ctx = this.ctx;
    let y = col * this.cellSize + this.halfCellSize;
    let x = row * this.cellSize + this.halfCellSize;
    ctx.strokeStyle = this.color.zero;
    ctx.lineWidth = this.width;
    ctx.beginPath();
    ctx.arc(x, y, this.radius,0,Math.PI*2,true);
    ctx.stroke();
  };

  this.renderCross = (row, col) => {
    let ctx = this.ctx;
    let x1 = row * 30 + 5;
    let x2 = row * 30 + 25;
    let y1 = col * 30 + 5;
    let y2 = col * 30 + 25;
    ctx.strokeStyle = this.color.cross;
    ctx.lineWidth = this.width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.moveTo(x2, y1);
    ctx.lineTo(x1, y2);
    ctx.stroke();
  };

  this.renderLine = () => {
    let ctx = this.ctx;
    ctx.strokeStyle = this.color.line;
    ctx.beginPath();
    ctx.lineWidth = this.width / 2;
    ctx.moveTo( this.model.line[1] * 30 + 15, this.model.line[0] * 30 + 15);
    ctx.lineTo(this.model.line[3] * 30 + 15, this.model.line[2] * 30 + 15);
    ctx.stroke();
    ctx.closePath();
  };

  this.renderButton = (color, text, arr) => {
    let ctx = this.cts;
    ctx.fillStyle = color;
    ctx.fillRect(arr[0], 0, arr[1], this.cellSize * 3);
    ctx.font = "30px Arial";
    ctx.fillStyle = this.color.black;
    ctx.textAlign = "center";
    ctx.fillText(text, arr[0] + 40, 50);
  };

  this.renderMove = rc => {
    row = rc.row || this.model.row;
    col = rc.col || this.model.col;
    if (this.model.board[row][col] === 2){
      this.renderCross(row, col);
    }
    else{
      this.renderZero(row, col);
    }
  };

  this.setCursor = (x, y) => {
    if(x > 0 && x < 90 || x > (this.scoreboard.width - 90) &&
     x < this.scoreboard.width)
      this.scoreboard.style.cursor = "pointer";
    else
      this.scoreboard.style.cursor = "default";
  };

  this.renderScore = () => {
    let player1 = this.model.player1;
    let player2;
    let ctx = this.cts;
    player2 = (!this.model.cpuMode) ? this.model.player2 : this.model.playerCPU;
    let text = `${player1} : ${player2}`;
    ctx.font = "45px Arial";
    ctx.fillStyle = '#fff';
    ctx.textAlign = "center";
    ctx.fillText(text, this.scoreboard.width / 2, 50);
  }


  this.init();
}
// END VIEW


// BEGIN CONTROLLER
function AppCtrl(model, view) {
  let AppCtrl = this;
  this.model = model;
  this.view = view;

  this.init = () => {
    AppCtrl.mouse = new mouseCtrl(this.view.canvas, AppCtrl.move, AppCtrl.click);
    AppCtrl.setCursorMouse = new mouseCtrl(this.view.scoreboard, AppCtrl.btnMove, AppCtrl.btnClick);
    AppCtrl.newGame(1);
  };

  this.newGame = a => {
    if(a === 1)
      this.model.cpuMode = true;
    else
      this.model.cpuMode = false;
    this.view.renderScoreboard();
    this.view.renderBoard();
    this.model.setStartData(a);
  };

  this.moveAI = () => {
        if(this.model.cpuMode){
          let rc = model.moveAI();
        this.view.renderMove(rc);
        if (!this.model.playing)
            this.view.renderLine();
        }

    };

    this.moveUser = () => {
        if (!this.model.emptyCell())
            return;
        let rc = this.model.moveUser();
        this.view.renderMove(rc);
        if (!this.model.playing)
            this.view.renderLine();
        else
            this.moveAI();
    };

    this.btnMove = (x, y) => {
      if (!AppCtrl.model.playing)
            return;
      this.view.setCursor(x, y);
    };

    this.btnClick = (x, y) => {
      if(x > 0 && x < 90){
        this.newGame(2); // 1 player mode
      }else if(x > (this.view.scoreboard.width - 90) && x < this.view.scoreboard.width){
         this.newGame(1);// 2 players mode
      }
    };

    this.move = (x, y) => {
        if (!AppCtrl.model.playing)
            return;
        AppCtrl.model.setRC(AppCtrl.coord(x, y));
    };

    this.coord = (x, y) => {
      let row = Math.floor(x / 30);
      let col = Math.floor(y / 30);
      return { row: row, col: col};
    };

    this.click = () => {
        if (!AppCtrl.model.playing)
            return;
        AppCtrl.moveUser();
    };

  this.init();
};

function mouseCtrl(elem, move, click){
  let mouseCtrl = this;
  this.x = 0;
  this.y = 0;
  this.elem = elem;
  this.moveApp = move;
  this.clickApp = click;

  this.move = e => {
    this.x = e.pageX - this.elem.offsetLeft;
    this.y = e.pageY - this.elem.offsetTop;
    this.moveApp(this.x, this.y);
    return {x: this.x, y: this.y}
  };

  this.click = e => {
    this.clickApp(this.x, this.y);
  };

  this.elem.addEventListener('mousemove', e => mouseCtrl.move(e));

  this.elem.addEventListener('click', e => mouseCtrl.click(e));

}
// END CONTROLLER
