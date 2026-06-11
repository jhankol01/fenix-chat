<?php
$src = __DIR__;
$dst = dirname(__DIR__);

echo "Source: $src\nDest: $dst\n\n";

function copyDir($src, $dst) {
    $count = 0;
    if (!is_dir($dst)) mkdir($dst, 0755, true);
    chmod($dst, 0755);
    $items = scandir($src);
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        $srcPath = "$src/$item";
        $dstPath = "$dst/$item";
        if (is_dir($srcPath)) {
            $count += copyDir($srcPath, $dstPath);
        } else {
            copy($srcPath, $dstPath);
            chmod($dstPath, 0644);
            $count++;
        }
    }
    return $count;
}

// Remove default.php
if (file_exists("$dst/default.php")) {
    unlink("$dst/default.php");
    echo "Removed default.php\n";
}

// Copy EVERYTHING recursively
$total = copyDir($src, $dst);
echo "Copied $total files total\n";

// Create .htaccess
$htaccess = "RewriteEngine On\nRewriteBase /\nRewriteRule ^index\\.html$ - [L]\nRewriteCond %{REQUEST_FILENAME} !-f\nRewriteCond %{REQUEST_FILENAME} !-d\nRewriteRule . /index.html [L]\n";
file_put_contents("$dst/.htaccess", $htaccess);
chmod("$dst/.htaccess", 0644);
echo "Created .htaccess\n";

// List final
echo "\nFinal contents:\n";
foreach(scandir($dst) as $f) {
    if ($f === '.' || $f === '..') continue;
    $type = is_dir("$dst/$f") ? '[DIR]' : '[FILE]';
    echo "  $type $f\n";
}
echo "\nALL DONE!";
