using System.Reflection;
using SadConsole.Configuration;

Settings.WindowTitle = $"DN Gasbag {Assembly.GetExecutingAssembly().GetName().Version}";
Settings.ResizeMode = Settings.WindowResizeOptions.Stretch;

Builder
    .GetBuilder()
    .SetWindowSizeInCells(80, 25)
    .SetStartingScreen<Gasbag.Scenes.Menu>()
    .IsStartingScreenFocused(true)
    .ConfigureFonts(true)
    .Run();