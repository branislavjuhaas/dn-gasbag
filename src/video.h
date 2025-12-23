#ifndef VIDEO_H
#define VIDEO_H

void clear_screen(unsigned char attribute);

#pragma aux clear_screen =      \
"mov ax, 0B800h"                \
"mov es, ax"                    \
"xor di, di"                    \
"mov ah, bl"                    \
"mov al, 20h"                   \
"mov cx, 4000"                  \
"rep stosw"                     \
parm [bl]                       \
modify [ax cx di es];

#endif
