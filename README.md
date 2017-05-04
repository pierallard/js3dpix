# js3dpix

Just a simple library to display 3D pixels into a Canvas without using WebGL.

Here is a [Live example](https://pierallard.github.io/) with a rotation.

Here is an example shot:

![Example](https://github.com/pierallard/js3dpix/blob/master/example.png)

## Limitations

Not a lot of tests were done, but it takes ~ 100ms to display 1000 cubes

There is some "weird stuff" when you try to display cubes elsewhere than a fake "grid". For example, don't display 2 cubes at (0,0,0) and (0,0.5,0), it will fail.

## How it works?

Look at [index.htm](index.htm)
