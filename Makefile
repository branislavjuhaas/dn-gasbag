TARGET = dos
CC = wcl

!ifdef DEBUG
CFLAGS = -bt=$(TARGET) -d2 -ms -zq
LDFLAGS = -"debug all"
!else
CFLAGS = -bt=$(TARGET) -ox -ms -zq
LDFLAGS =
!endif

SRC = src\main.c src\video.c
OUT = gasbag.exe

# Default target
all : clean $(OUT) .SYMBOLIC

# Simple rule: Build the output from source
$(OUT): $(SRC)
	$(CC) $(CFLAGS) $(SRC) $(LDFLAGS) -fe=$(OUT)

clean : .SYMBOLIC
	@if exist *.obj del *.obj
	@if exist *.err del *.err
	@if exist $(OUT) del $(OUT)
