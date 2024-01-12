DECLARE SUB CTIMEDO ()
DECLARE SUB MENU (TYPER AS INTEGER)
DECLARE SUB PRINTMENU (PRESED AS INTEGER)
DECLARE SUB GIVESCORE ()
DECLARE SUB LEADERBOARD ()
DECLARE SUB RUNGAME ()
DECLARE SUB STARTGAME ()
DECLARE FUNCTION TFACTOR! ()
DECLARE FUNCTION XERA! ()
DECLARE SUB SUMBALLOON ()
DECLARE SUB FALLB ()
DECLARE SUB BRISE ()
DECLARE SUB SHOOT ()
DECLARE SUB MOVE (DIRECTION AS INTEGER)
'===DIMS==================================================================================
DIM SHARED SHOOTERX AS INTEGER
DIM SHARED RUNNING AS INTEGER
DIM SHARED SHOOTING AS INTEGER
DIM SHARED SHAPE AS STRING
DIM SHARED SPACE AS STRING
DIM SHARED BULLET(2) AS INTEGER
DIM SHARED CTIMER(3) AS INTEGER
DIM SHARED BALX(1) AS INTEGER
DIM SHARED BALY(1) AS INTEGER
DIM SHARED BALL(1) AS INTEGER
DIM SHARED BALD(1) AS INTEGER
DIM SHARED SPEED AS INTEGER
DIM SHARED SCORE AS INTEGER
DIM SHARED ADDSCORE AS INTEGER
DIM SHARED BSCORE(3) AS INTEGER
DIM SHARED BTIME(4) AS STRING
DIM SHARED SP AS STRING
DIM SHARED SELECTION AS INTEGER
DIM SHARED OLDTIMER AS INTEGER
DIM SHARED SBTN(4) AS STRING
DIM SHARED CON AS INTEGER
DIM SHARED ACTUAL AS LONG
DIM SHARED TEAPE AS INTEGER
'===CONSTS================================================================================
CONST TRUE = 1
CONST FALSE = 0
CONST EMP = ""
'===SETTING VALUES========================================================================
SBTN(1) = "     START     "
SBTN(2) = "    CONTINUE   "
SBTN(4) = "    RESTART    "
SELECTION = 1

MENU (1)

STARTGAME

RUNGAME

SUB BRISE

LOCATE BULLET(2), BULLET(1)
PRINT " "
IF BULLET(2) > 1 THEN
        BULLET(2) = BULLET(2) - 1
        LOCATE BULLET(2), BULLET(1)
        PRINT "≥"
END IF

END SUB

SUB CTIMEDO
        IF CTIMER(1) < 10000 THEN
                CTIMER(1) = CTIMER(1) + 1
        END IF
     
        IF CTIMER(3) < 30000 THEN
                CTIMER(3) = CTIMER(3) + 1
        END IF

END SUB

SUB FALLB
DIM I%
I% = 1
LOCATE BALY(1), BALX(1)
PRINT "   "
LOCATE BALY(1) + 1, BALX(1)
PRINT "   "
BALY(1) = BALY(1) + 1
LOCATE BALY(1), BALX(1)
PRINT "…Õª"
LOCATE BALY(1) + 1, BALX(1)
PRINT "»Õº"
IF BALY(1) = 24 THEN
        BALL(1) = FALSE
        COLOR 15, 12
        CLS
        GIVESCORE
        LEADERBOARD
        STARTGAME
END IF
END SUB

SUB GIVESCORE
IF SCORE > BSCORE(3) THEN
        IF SCORE > BSCORE(2) THEN
                IF SCORE > BSCORE(1) THEN
                        BSCORE(3) = BSCORE(2)
                        BTIME(3) = BTIME(2)
                        BSCORE(2) = BSCORE(1)
                        BTIME(2) = BTIME(1)
                        BSCORE(1) = SCORE
                        BTIME(1) = TIME$
                ELSE
                        BSCORE(3) = BSCORE(2)
                        BTIME(3) = BTIME(2)
                        BSCORE(2) = SCORE
                        BTIME(2) = TIME$
                END IF
        ELSE
                BSCORE(3) = SCORE
                BTIME(3) = TIME$
        END IF
END IF
BTIME(4) = TIME$
END SUB

SUB LEADERBOARD
TEAPE = 2
CON = 4
PRINTMENU (FALSE)
WHILE INP(&H60) <> 28

        IF INP(&H60) = 77 OR INP(&H60) = 75 THEN
                IF SELECTION = 1 THEN
                        SELECTION = 2
                ELSE
                       SELECTION = 1
                END IF
                PRINTMENU (FALSE)
                SLEEP 1
        END IF
WEND
PRINTMENU (TRUE)
FOR I% = 1 TO 30000
        LOCATE 1, 1
        COLOR 7, 1
        PRINT " "
NEXT I%
PRINTMENU (FALSE)
FOR I% = 1 TO 30000
        LOCATE 1, 1
        COLOR 7, 1
        PRINT " "
NEXT I%

IF SELECTION = 2 THEN
        END
END IF

END SUB

SUB MENU (TYPER AS INTEGER)
TEAPE = 1
CON = TYPER
COLOR 15, 1
CLS
PRINTMENU (FALSE)
WHILE INP(&H60) <> 28

        IF INP(&H60) = 77 OR INP(&H60) = 75 THEN
                IF SELECTION = 1 THEN
                        SELECTION = 2
                ELSE
                       SELECTION = 1
                END IF
                PRINTMENU (FALSE)
                SLEEP 1
        END IF
WEND
PRINTMENU (TRUE)
        ACTUAL = INT(TIMER * 100) + 30
        WHILE ACTUAL > TIMER * 100
        WEND
PRINTMENU (FALSE)
        ACTUAL = INT(TIMER * 100) + 20
        WHILE ACTUAL > TIMER * 100
        WEND
IF SELECTION = 2 THEN
        END
END IF

IF CON = 2 THEN
        COLOR 15, 9
        CLS
        LOCATE 25, SHOOTERX
        PRINT SHAPE
        ADDSCORE = TRUE
END IF
END SUB

SUB MOVE (DIRECTION AS INTEGER)
LOCATE BALY(1), BALX(1)
PRINT "   "
LOCATE BALY(1) + 1, BALX(1)
PRINT "   "

        IF DIRECTION = 0 AND SHOOTERX > 1 THEN
                LOCATE 25, SHOOTERX
                PRINT SPACE
                SHOOTERX = SHOOTERX - 1
                LOCATE 25, SHOOTERX
                PRINT SHAPE
        ELSEIF DIRECTION = 1 AND (SHOOTERX + LEN(SHAPE)) <= 80 THEN
                LOCATE 25, SHOOTERX
                PRINT SPACE
                SHOOTERX = SHOOTERX + 1
                LOCATE 25, SHOOTERX
                PRINT SHAPE
        ELSEIF DIRECTION = 0 AND SHOOTERX = 1 THEN
                LOCATE 25, SHOOTERX
                PRINT SPACE
                SHOOTERX = 80 - LEN(SHAPE)
                LOCATE 25, SHOOTERX
                PRINT SHAPE
        ELSEIF DIRECTION = 1 AND (SHOOTERX + LEN(SHAPE)) >= 80 THEN
                LOCATE 25, SHOOTERX
                PRINT SPACE
                SHOOTERX = 1
                LOCATE 25, SHOOTERX
                PRINT SHAPE
        END IF
LOCATE BALY(1), BALX(1)
PRINT "…Õª"
LOCATE BALY(1) + 1, BALX(1)
PRINT "»Õº"

END SUB

SUB PRINTMENU (PRESED AS INTEGER)
SBTN(3) = SBTN(CON)
COLOR 15, 1
CLS
LOCATE 25, 80 - LEN("(C) 2021 BRANISLAV JUHAS") + 1
PRINT "(C) 2021 BRANISLAV JUHAS"
LOCATE 25, 1
PRINT "V1.0"
SELECT CASE SELECTION
        CASE 1

                IF PRESED = TRUE THEN
                        LOCATE 20, 23
                        COLOR 4, 1: PRINT "               "; "   "; : COLOR 7, 1: PRINT "‹‹‹‹‹‹‹‹‹‹‹‹‹‹‹‹"
                        LOCATE 21, 24
                        COLOR 1, 4: PRINT "               "; : COLOR 4, 1: PRINT "  "; : COLOR 1, 7: PRINT "      EXIT      "; : COLOR 4, 0: PRINT " "
                        LOCATE 22, 24
                        COLOR 1, 4: PRINT "               "; : COLOR 4, 1: PRINT "  "; : COLOR 7, 1: PRINT "ﬂ"; : COLOR 7, 0: PRINT "ﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂ"; : COLOR 4, 0: PRINT " "
                ELSE
                        LOCATE 20, 23
                        COLOR 4, 1: PRINT "‹‹‹‹‹‹‹‹‹‹‹‹‹‹‹"; "   "; : COLOR 7, 1: PRINT "‹‹‹‹‹‹‹‹‹‹‹‹‹‹‹‹"
                        LOCATE 21, 23
                        COLOR 1, 4: PRINT SBTN(3); : COLOR 4, 0: PRINT " "; : COLOR 4, 1: PRINT "  "; : COLOR 1, 7: PRINT "      EXIT      "; : COLOR 4, 0: PRINT " "
                        LOCATE 22, 23
                        COLOR 4, 1: PRINT "ﬂ"; : COLOR 4, 0: PRINT "ﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂ"; " "; : COLOR 4, 1: PRINT "  "; : COLOR 7, 1: PRINT "ﬂ"; : COLOR 7, 0: PRINT "ﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂ"; : COLOR 4, 0: PRINT " "

                END IF
       CASE 2
                IF PRESED = TRUE THEN
                        LOCATE 20, 23
                        COLOR 7, 1: PRINT "‹‹‹‹‹‹‹‹‹‹‹‹‹‹‹"; "    "; : COLOR 4, 1: PRINT ""
                        LOCATE 21, 23
                        COLOR 1, 7: PRINT SBTN(3); : COLOR 4, 0: PRINT " "; : COLOR 4, 1: PRINT "   "; : COLOR 1, 4: PRINT "                "
                        LOCATE 22, 23
                        COLOR 7, 1: PRINT "ﬂ"; : COLOR 7, 0: PRINT "ﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂ"; : COLOR 4, 0: PRINT " "; : COLOR 4, 1: PRINT "   "; : COLOR 1, 4: PRINT "                ";
                ELSE
                        LOCATE 20, 23
                        COLOR 7, 1: PRINT "‹‹‹‹‹‹‹‹‹‹‹‹‹‹‹"; "   "; : COLOR 4, 1: PRINT "‹‹‹‹‹‹‹‹‹‹‹‹‹‹‹‹"
                        LOCATE 21, 23
                        COLOR 1, 7: PRINT SBTN(3); : COLOR 4, 0: PRINT " "; : COLOR 4, 1: PRINT "  "; : COLOR 1, 4: PRINT "      EXIT      "; : COLOR 4, 0: PRINT " "
                        LOCATE 22, 23
                        COLOR 7, 1: PRINT "ﬂ"; : COLOR 7, 0: PRINT "ﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂ"; : COLOR 4, 0: PRINT " "; : COLOR 4, 1: PRINT "  "; : COLOR 4, 1: PRINT "ﬂ"; : COLOR 4, 0: PRINT "ﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂﬂ"; " "

                END IF
END SELECT
SELECT CASE TEAPE
        CASE 1
                COLOR 7, 1
                LOCATE 8, 23
                PRINT " ‹‹‹   ‹‹‹   ‹‹‹‹ ‹‹‹‹   ‹‹‹   ‹‹‹ "
                COLOR 7, 1
                LOCATE 9, 23
                PRINT "€   ﬂ €   € ﬂ‹‹‹  €‹‹‹ﬂ €   € €   ﬂ"
                COLOR 7, 1
                LOCATE 10, 23
                PRINT "€ ﬂﬂ€ €ﬂﬂﬂ€ ‹   € €   € €ﬂﬂﬂ€ € ﬂﬂ€"
                LOCATE 11, 23
                COLOR 7, 1
                PRINT " ﬂﬂﬂ  ﬂ   ﬂ  ﬂﬂﬂ  ﬂﬂﬂﬂ  ﬂ   ﬂ  ﬂﬂﬂ "
                LOCATE 12, 47
                PRINT "HELLO WORLD!"
        CASE 2
                COLOR 15, 1
                LOCATE 5, 1
                PRINT "                      …ÕÕ SCORE ÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕª"
                FOR I% = 1 TO 3
                        IF BSCORE(I%) < 10 THEN
                                PRINT "                     "; STR$(I%); ".             "; STR$(BSCORE(I%)); "    "; "            ∫"
                        ELSEIF BSCORE(I%) > 9 AND BSCORE(I%) < 100 THEN
                                PRINT "                     "; STR$(I%); ".             "; STR$(BSCORE(I%)); "   "; "            ∫"
                        ELSEIF BSCORE(I%) > 99 THEN
                                PRINT "                     "; STR$(I%); ".             "; STR$(BSCORE(I%)); "  "; "            ∫"
                        END IF
                        IF BTIME(I%) = EMP THEN
                                PRINT "                      ∫            --:--:--            ∫"
                        ELSE
                                PRINT "                      ∫            "; BTIME(I%); "            ∫"
                        END IF
                        PRINT "                      ÃÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕπ"
                NEXT I%
                        IF SCORE < 10 THEN
                                PRINT "                      ACTUAL         "; STR$(SCORE); "    "; "            ∫"
                        ELSEIF SCORE > 9 AND SCORE < 100 THEN
                PRINT "                      ACTUAL         "; STR$(SCORE); "   "; "            ∫"
                        ELSEIF SCORE > 99 THEN
                                PRINT "                      ACTUAL         "; STR$(SCORE); "  "; "            ∫"
                        END IF


                PRINT "                      ∫            "; BTIME(4); "            ∫"
                PRINT "                      »ÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕÕº"

END SELECT
END SUB

SUB RUNGAME
WHILE RUNNING = TRUE
        IF BULLET(2) = BALY(1) AND XERA = TRUE THEN
                BALL(1) = FALSE
                LOCATE BALY(1), BALX(1)
                PRINT "  "
                LOCATE BALY(1) + 1, BALX(1)
                PRINT "  "
               
                IF ADDSCORE = TRUE THEN
                        SCORE = SCORE + 1
                        BALD(1) = 10 - INT(SCORE / 10)
                        ADDSCORE = FALSE
                END IF
        END IF
      
      
      
      
        IF CTIMER(3) > BALD(1) THEN
                SUMBALLOON
                CTIMER(3) = 0
        END IF
      
      
        IF INP(&H60) = 75 AND CTIMER(1) >= 1 THEN
                MOVE (0)
                CTIMER(1) = 0
        ELSEIF INP(&H60) = 77 AND CTIMER(1) >= 1 THEN
                MOVE (1)
                CTIMER(1) = 0
        END IF

        IF INP(&H60) = 1 THEN
                MENU (2)
        END IF
        
        IF INP(&H60) = 57 THEN
                SHOOT
        END IF

        IF SHOOTING = TRUE AND CTIMER(2) > 10 THEN
                BRISE
                CTIMER(2) = 0
        END IF
     
        IF ACTUAL < TIMER * 100 THEN
                CTIMEDO
                ACTUAL = INT(TIMER * 100) + 1
        END IF

              
        IF CTIMER(2) < 10000 THEN
                CTIMER(2) = CTIMER(2) + 1
        END IF

      
WEND
END SUB

SUB SHOOT
SHOOTING = TRUE
BULLET(1) = SHOOTERX + 2
BULLET(2) = 24
LOCATE BULLET(2), BULLET(1)
PRINT "≥"
END SUB

SUB STARTGAME
BALY(1) = 1
BALX(1) = 1
COLOR 15, 9
BALD(1) = 10
SHAPE = "ƒÕ Õƒ"
SPACE = "     "
SPEED = 500
SHOOTERX = 37
RUNNING = TRUE
SHOOTING = FALSE
BALY(1) = 1
CLS
LOCATE 25, SHOOTERX
PRINT SHAPE
SCORE = 0
ADDSCORE = TRUE
END SUB

SUB SUMBALLOON
        IF BALL(1) = FALSE THEN
                BALL(1) = TRUE
                BALY(1) = 1
                BALX(1) = INT(RND * 76) + 2
                LOCATE 1, BALX(1)
                PRINT "»Õº"
                ADDSCORE = TRUE
        ELSE
                FALLB
        END IF
END SUB

FUNCTION XERA
IF BULLET(1) = BALX(1) OR BULLET(1) = BALX(1) + 1 OR BULLET(1) = BALX(1) + 2 THEN
        XERA = TRUE
ELSE
        XERA = FALSE
END IF

END FUNCTION

