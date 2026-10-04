# 從 JavaScript 走向 TypeScript
這是依 TypeScript 官方手冊整理的入門筆記，不是官方翻譯。先理解值與變數，再認識型別檢查。

## 值、變數與函式
程式會處理不同種類的值，例如數字 3、字串 "MAG" 與布林值 true。JavaScript 的 let 可以宣告之後要重新賦值的變數；例如 let score = 3; 接著 score = 4;。
函式把一段可重複執行的操作取名字。參數是傳入的值，return 是傳回的結果。例如 function double(n) { return n * 2; }，double(3) 的結果是 6。

## TypeScript 加上執行前的檢查
TypeScript 建立在 JavaScript 上，加上靜態型別檢查；它能在執行前找出某些型別使用錯誤，不保證程式沒有所有錯誤。
例如 let score: number = 3; 表示 score 預期存放數字。接著寫 score = "三";，TypeScript 會回報字串不能賦值給 number。
常用的基本型別是 string、number、boolean，型別名稱使用小寫。number 包含整數與小數。

## 不必每次都手動標註
let score = 3; 通常已讓 TypeScript 推斷 score 是 number，所以之後賦值成字串仍會出現型別錯誤。型別標註可以清楚表達意圖，但不是每一處都需要。
函式的參數可以加上型別，例如 function double(n: number) { return n * 2; }。呼叫 double("3") 會被型別檢查指出問題；回傳型別通常可以從內容推斷。

## 型別檢查與真正執行是兩回事
一般編譯流程會移除型別標註，輸出 JavaScript。let score: number = 3; 會成為不含 : number 的 JavaScript 宣告。
這些型別標註不會自動驗證執行時的外部資料。從網路收到的資料仍需要執行時驗證。編譯是否在發現錯誤時仍輸出檔案，取決於編譯器設定，例如 noEmitOnError。

## 來源
TypeScript for the New Programmer — https://www.typescriptlang.org/docs/handbook/typescript-from-scratch.html
Everyday Types — https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
The Basics — https://www.typescriptlang.org/docs/handbook/2/basic-types.html
